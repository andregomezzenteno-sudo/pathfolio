# -*- coding: utf-8 -*-
"""Prueba del pipeline de generación de contenido (engine/generate_archetypes.py).

El sitio publicado no llama a ningún modelo: los textos se generaron una vez y
viajan como JSON estático. Este pipeline es la herramienta que los produce, y
el README invita a ejecutarlo. Ahí está el riesgo que cierra esta prueba: si
alguien lo intenta y revienta, queda peor que si no existiera.

Se ejercita el código REAL —el grafo, los nodos, la construcción de los
prompts, el esquema de salida— sustituyendo solo el modelo por un doble. Así
se detectan los fallos que de verdad pueden colarse (una clave que ya no
existe en allocations.json, un prompt que no formatea, un grafo mal cableado)
sin gastar ni una llamada ni un céntimo.

    python tests/pipeline.test.py
"""
import json
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def install_stubs():
    """Dobles de las dependencias externas. No se instala langchain para correr
    esto: lo que se prueba es la lógica del pipeline, no la librería."""
    calls = []

    class FakeStructuredLLM:
        def invoke(self, prompt):
            calls.append(prompt)
            result = types.SimpleNamespace()
            result.headline = "Titular de prueba lo bastante largo para pasar validaciones."
            result.detail = ("Detalle de prueba, deliberadamente extenso para que se parezca a lo "
                             "que devolvería el modelo de verdad y no a un marcador vacío.")
            return result

    class FakeLLM:
        def __init__(self, *a, **k):
            pass

        def with_structured_output(self, schema):
            return FakeStructuredLLM()

        def invoke(self, prompt):
            calls.append(prompt)
            return types.SimpleNamespace(content="Respuesta de prueba para el FAQ.")

    anthropic = types.ModuleType("langchain_anthropic")
    anthropic.ChatAnthropic = FakeLLM
    sys.modules["langchain_anthropic"] = anthropic

    class FakeGraph:
        def __init__(self, *a, **k):
            self.nodes, self.edges = [], []

        def add_node(self, name, fn):
            self.nodes.append((name, fn))

        def add_edge(self, a, b):
            self.edges.append((a, b))

        def compile(self):
            return self

    graph_mod = types.ModuleType("langgraph.graph")
    graph_mod.START, graph_mod.END = "START", "END"
    graph_mod.StateGraph = FakeGraph
    sys.modules["langgraph"] = types.ModuleType("langgraph")
    sys.modules["langgraph.graph"] = graph_mod

    pydantic = types.ModuleType("pydantic")
    pydantic.BaseModel = object
    pydantic.Field = lambda **kw: kw.get("description", "")
    sys.modules["pydantic"] = pydantic

    return calls


def main():
    calls = install_stubs()
    sys.path.insert(0, str(ROOT / "engine"))
    import generate_archetypes as pipe

    failures = []

    def check(cond, msg):
        if not cond:
            failures.append(msg)

    allocations = pipe.load_allocations()
    shipped = json.loads((ROOT / "archetypes.json").read_text(encoding="utf-8"))

    # 1) El pipeline y el contenido publicado tienen que hablar del mismo
    #    conjunto de perfiles. Si divergen, regenerar sobrescribiría con
    #    combinaciones distintas de las que la app espera.
    combos = pipe.reachable_combinations(allocations)
    need = {"%s|%s" % c for c in combos}
    have = set(shipped["explanations"]["es"])
    check(need == have,
          "las combinaciones del pipeline no coinciden con archetypes.json: %s" % (need ^ have))

    # 2) Los pesos que el pipeline mete en el prompt salen de la MISMA curva que
    #    usa la app. Si se desincronizan, el texto describiría una cartera que
    #    nadie recibe.
    for tier, score in pipe.TIER_SCORE.items():
        w = pipe.weights_for_score(score, allocations)
        check(abs(sum(w.values()) - 1) < 1e-9, "los pesos de %s no suman 1" % tier)
        check(all(v >= 0 for v in w.values()), "hay pesos negativos en %s" % tier)
    check(pipe.weights_for_score(84, allocations)["equities"] > pipe.weights_for_score(16, allocations)["equities"],
          "más riesgo debería dar más renta variable")

    # 3) El grafo se cablea de verdad: dos nodos y el recorrido completo.
    app = pipe.build_graph(pipe.ChatAnthropic(model=pipe.MODEL, temperature=0.4))
    node_names = [n for n, _ in app.nodes]
    check(node_names == ["allocate", "explain"], "nodos inesperados en el grafo: %s" % node_names)
    check(("START", "allocate") in app.edges and ("explain", "END") in app.edges,
          "el grafo no conecta START -> allocate -> explain -> END")

    # 4) El nodo que habla con el modelo se ejecuta y produce un prompt válido.
    #    Aquí es donde reventaría de verdad si una clave hubiera cambiado.
    explain = dict(app.nodes)["explain"]
    state = {
        "effective_risk": "moderado",
        "horizon": "jubilacion",
        "weights": pipe.weights_for_score(pipe.TIER_SCORE["moderado"], allocations),
        "headline": None, "detail": None,
    }
    out = explain(state)
    check(out["headline"] and out["detail"], "el nodo explain no devolvió contenido")

    prompt = calls[-1]
    check("%" in prompt, "el prompt debería llevar los porcentajes de la cartera")
    check("renta variable" in prompt and "renta fija" in prompt,
          "el prompt debería usar la terminología actual de la app")
    check("castellano de España" in prompt,
          "el prompt debería exigir castellano de España, o regeneraría en otro dialecto")
    check("no los menciones" in prompt,
          "el prompt debería aclarar que los bloques opcionales se explican aparte")

    # 5) El FAQ cubre exactamente las preguntas que la app enseña.
    faq = pipe.generate_faq(pipe.ChatAnthropic(model=pipe.MODEL, temperature=0.4))
    check(set(faq) == set(shipped["faq"]["es"]),
          "los temas del FAQ no coinciden con los publicados: %s" % (set(faq) ^ set(shipped["faq"]["es"])))

    # 6) El esquema de salida sigue declarando los dos campos que se guardan.
    check(hasattr(pipe.Explanation, "__annotations__"), "Explanation debería declarar sus campos")
    check(set(pipe.Explanation.__annotations__) == {"headline", "detail"},
          "Explanation debería tener exactamente headline y detail")

    if failures:
        print("FALLOS EN EL PIPELINE:")
        for f in failures:
            print("  -", f)
        sys.exit(1)

    print("OK: el pipeline de LangGraph se construye, recorre sus nodos y produce prompts válidos")
    print("OK: sus %d combinaciones y sus %d temas de FAQ coinciden con el contenido publicado" % (len(combos), len(faq)))
    print("OK: los pesos que describe salen de la misma curva de riesgo que usa la app")
    print("\nPRUEBAS DEL PIPELINE DE CONTENIDO: PASAN")


if __name__ == "__main__":
    main()
