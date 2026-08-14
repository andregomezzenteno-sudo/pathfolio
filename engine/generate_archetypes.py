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


def compute_effective_risk(stated_risk: str, horizon: str, allocations: dict) -> tuple[str, bool]:
    """Mirrors computeEffectiveRisk() in ../app.js — horizon can only pull the
    effective risk tier DOWN from what the user stated, never up: a short
    horizon objectively limits how much volatility you can absorb before
    needing the money, regardless of stated risk appetite."""
    cap = allocations["horizonCap"].get(horizon)
    if not cap:
        return stated_risk, False
    order = allocations["riskOrder"]
    effective = cap if order.index(cap) < order.index(stated_risk) else stated_risk
    return effective, effective != stated_risk


def reachable_combinations(allocations: dict) -> list[tuple[str, str]]:
    """Every (effective_risk, horizon) pair the app can actually reach after
    the horizon cap is applied — e.g. "arriesgado" never survives a "viaje"
    horizon, so that combination is never generated."""
    combos = set()
    for stated_risk in allocations["riskOrder"]:
        for horizon in allocations["horizonCap"]:
            effective, _ = compute_effective_risk(stated_risk, horizon, allocations)
            combos.add((effective, horizon))
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
        weights = allocations["buckets"][effective_risk]
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
