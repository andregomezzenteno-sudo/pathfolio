"""
generate_archetypes.py — the real generation pipeline behind ../archetypes.json.

The public PathFolio site ships static, pre-generated explanation content so
it never makes a paid LLM call per visitor (no backend, no exposed API key,
zero ongoing cost). This script is the actual LangGraph pipeline that
produced that content — run it yourself with an Anthropic API key to
regenerate it live, end to end.

Usage:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...
    python generate_archetypes.py

Design note: the allocation NUMBERS are deterministic — computed from
../allocations.json, the same file the client-side app reads, via
compute_effective_risk() below (a Python port of app.js's identical logic).
The LLM's only job in this pipeline is to explain an already-decided, fixed
allocation in plain language; it never decides the numbers themselves. That
keeps the actual financial output auditable and free of hallucination risk,
while still exercising a real multi-node LangGraph pipeline for the
explanation and FAQ generation — the skill this project is meant to
demonstrate.
"""

import json
import os
from pathlib import Path
from typing import Optional, TypedDict

from langchain_anthropic import ChatAnthropic
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
ALLOCATIONS_PATH = ROOT / "allocations.json"
OUTPUT_PATH = ROOT / "archetypes.json"

MODEL = "claude-sonnet-5"

HORIZON_LABELS = {
    "viaje": "un viaje o una meta cercana en el tiempo",
    "casa": "comprar una casa",
    "crecer": "hacer crecer el dinero, sin una meta fija",
    "jubilacion": "la jubilación, a muchos años vista",
}
RISK_LABELS = {
    "conservador": "prioriza no perder valor antes que crecer rápido",
    "moderado": "busca un balance entre crecer y no sufrir grandes caídas",
    "arriesgado": "prioriza el crecimiento y tolera caídas fuertes en el camino",
}

# Regla de dialecto, en un único sitio porque la usan los dos prompts. Las
# líneas van marcadas para que el guard de dialecto de la suite de pruebas no
# las cuente: enumeran a propósito las formas que hay que evitar.
DIALECT_RULE = (  # dialect-guard-ignore
    "Escribe en castellano de España, tuteando (tú, tienes, puedes, quieres). "  # dialect-guard-ignore
    "Nada de voseo ni de formas rioplatenses (sos, tenés, podés, querés) ni de "  # dialect-guard-ignore
    "americanismos como 'plata' por dinero: el resto de la aplicación está en "  # dialect-guard-ignore
    "español de España y el texto tiene que sonar igual."  # dialect-guard-ignore
)

FAQ_TOPICS = {
    "risk": "por qué preguntamos cómo reaccionaría alguien si su inversión bajara un 20 %",
    "horizon": "por qué preguntamos para qué es el dinero y cuándo se va a necesitar",
    "style": "por qué preguntamos si se prefiere detalle técnico o solo el resultado",
    "amount": "por qué pedimos un importe ilustrativo para invertir",
}


def load_allocations() -> dict:
    with open(ALLOCATIONS_PATH, encoding="utf-8") as f:
        return json.load(f)


def tier_of(score: float) -> str:
    """Espejo de sliderToTier() en ../engine.js."""
    if score <= 33:
        return "conservador"
    if score <= 66:
        return "moderado"
    return "arriesgado"


def interpolate_curve(points: list, x: float, field: str) -> float:
    """Espejo de interpolateCurve() en ../engine.js. El reparto sale de una
    curva continua, no de tres cajas fijas: cada puntuación de riesgo da los
    suyos."""
    pts = sorted(points, key=lambda p: p["score"])
    if x <= pts[0]["score"]:
        return pts[0][field]
    if x >= pts[-1]["score"]:
        return pts[-1][field]
    for i in range(1, len(pts)):
        if x <= pts[i]["score"]:
            a, b = pts[i - 1], pts[i]
            t = (x - a["score"]) / (b["score"] - a["score"])
            return a[field] + t * (b[field] - a[field])
    return pts[-1][field]


def weights_for_score(score: float, allocations: dict) -> dict:
    """Espejo de getAllocationWeights() en ../engine.js."""
    w = {k: interpolate_curve(allocations["riskCurve"], score, k)
         for k in ("equities", "bonds", "cash")}
    total = sum(w.values())
    return {k: v / total for k, v in w.items()}


def compute_effective_score(stated_score: float, horizon: str, allocations: dict) -> tuple[float, bool]:
    """Espejo de computeEffectiveRisk() en ../engine.js: el horizonte solo
    puede BAJAR la puntuación, nunca subirla, y el tope es una puntuación
    máxima en vez de un escalón — así no se pierde la resolución del slider."""
    cap = allocations["horizonMaxScore"].get(horizon, 100)
    if cap is not None and cap < stated_score:
        return cap, True
    return stated_score, False


# Puntuación representativa de cada nivel: se usa solo para redactar el texto
# del arquetipo, que habla del perfil en general. Los pesos que ve el usuario
# salen de SU puntuación exacta, no de estas.
TIER_SCORE = {"conservador": 16, "moderado": 50, "arriesgado": 84}


def reachable_combinations(allocations: dict) -> list[tuple[str, str]]:
    """Cada par (nivel efectivo, horizonte) que la app puede alcanzar de verdad
    tras aplicar el tope del horizonte — p. ej. "arriesgado" nunca sobrevive a
    un horizonte de "viaje", así que esa combinación no se genera."""
    combos = set()
    for tier, score in TIER_SCORE.items():
        for horizon in allocations["horizonMaxScore"]:
            effective_score, _ = compute_effective_score(score, horizon, allocations)
            combos.add((tier_of(effective_score), horizon))
    return sorted(combos)


class Explanation(BaseModel):
    headline: str = Field(description="1-2 warm, direct sentences (in Spain Spanish, using tú — never voseo) summarizing why this allocation fits this person's situation")
    detail: str = Field(description="A more thorough paragraph explaining the reasoning behind each component, framed as an illustrative example, never as direct personalized advice")


class GraphState(TypedDict):
    effective_risk: str
    horizon: str
    weights: dict
    headline: Optional[str]
    detail: Optional[str]


def build_graph(llm: ChatAnthropic):
    structured_llm = llm.with_structured_output(Explanation)

    def allocate_node(state: GraphState) -> GraphState:
        # No-op on purpose: the allocation is already decided (deterministically,
        # upstream, from allocations.json) by the time it enters the graph. This
        # node exists so the pipeline's shape documents that fact explicitly,
        # rather than implying the LLM chose the weights.
        return state

    def explain_node(state: GraphState) -> GraphState:
        w = state["weights"]
        prompt = (
            "Eres un asistente financiero que explica inversiones a alguien que "
            "nunca ha invertido y a quien le intimida el vocabulario técnico. Nada "
            "de jerga sin explicar: si usas un término como ETF o volatilidad, "
            "acláralo con lenguaje cotidiano.\n\n"
            f"Perfil: {RISK_LABELS[state['effective_risk']]}. El dinero es para "
            f"{HORIZON_LABELS[state['horizon']]}.\n"
            f"Reparto ya decidido (no lo cuestiones, tu trabajo es explicarlo): "
            f"{round(w['equities'] * 100)} % en renta variable (acciones de grandes "
            f"empresas, vía fondos indexados), {round(w['bonds'] * 100)} % en renta "
            f"fija (préstamos al Estado y a grandes empresas, los llamados bonos) y "
            f"{round(w['cash'] * 100)} % en efectivo.\n\n"
            "Este es el reparto BASE del perfil. La aplicación puede recortar "
            "después una parte de la renta variable hacia bloques opcionales "
            "(inmobiliario, private equity, otras inversiones) que el usuario elija; "
            "no los menciones aquí, se explican por separado.\n\n"
            "IMPORTANTE — " + DIALECT_RULE + "\n\n"
            "Enmárcalo siempre como un ejemplo ilustrativo (\"así se ve una cartera "
            "con este perfil\"), nunca como asesoramiento directo (\"te "
            "recomendamos\")."
        )
        result = structured_llm.invoke(prompt)
        return {**state, "headline": result.headline, "detail": result.detail}

    graph = StateGraph(GraphState)
    graph.add_node("allocate", allocate_node)
    graph.add_node("explain", explain_node)
    graph.add_edge(START, "allocate")
    graph.add_edge("allocate", "explain")
    graph.add_edge("explain", END)
    return graph.compile()


def generate_faq(llm: ChatAnthropic) -> dict:
    faq = {}
    for key, topic in FAQ_TOPICS.items():
        prompt = (
            "Escribe, en castellano de España y sin jerga financiera, una respuesta "
            "corta (2-3 frases) a la pregunta \"¿por qué me preguntáis esto?\" para "
            f"alguien que nunca ha invertido. El tema es: {topic}. " + DIALECT_RULE +
            " Devuelve solo el texto, sin comillas."
        )
        faq[key] = llm.invoke(prompt).content.strip()
    return faq


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("Set ANTHROPIC_API_KEY before running this script.")

    allocations = load_allocations()
    llm = ChatAnthropic(model=MODEL, temperature=0.4)
    app = build_graph(llm)

    explanations = {}
    for effective_risk, horizon in reachable_combinations(allocations):
        weights = weights_for_score(TIER_SCORE[effective_risk], allocations)
        result = app.invoke({
            "effective_risk": effective_risk,
            "horizon": horizon,
            "weights": weights,
            "headline": None,
            "detail": None,
        })
        explanations[f"{effective_risk}|{horizon}"] = {
            "headline": result["headline"],
            "detail": result["detail"],
        }
        print(f"generated {effective_risk}|{horizon}")

    output = {
        "_provenance": "Generated live by generate_archetypes.py via Claude (Anthropic) + LangGraph.",
        "faq": generate_faq(llm),
        "horizonCapNotice": (
            "Contestaste que tolerarías más riesgo, pero como esta meta es a corto "
            "plazo hemos ajustado la mezcla hacia algo más estable, para que no te "
            "veas obligado a vender justo en un mal momento."
        ),
        "explanations": explanations,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
