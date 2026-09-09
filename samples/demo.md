# Demo-document

Dit is een **vet** en *cursief* voorbeeld, met ~~doorgehaalde~~ tekst en een [externe link](https://example.com).

#### Kop 4

##### Kop 5

###### Kop 6

> Een citaatblok.

![Demo](images/demo.svg)

| Naam | Rol |
| --- | --- |
| Ada | Ingenieur |
| Grace | Programmeur |

CPU
: Processor

RAM
: Werkgeheugen

```python
def greet(name):
    return f"Hello, {name}"
```

---

## Lijsten

- Eerste punt
- Tweede punt

1. Een
2. Twee

## Taken

- [ ] Nog doen
- [x] Afgevinkt

Open het [gekoppelde document](linked.md).

### Stroomdiagram

Dubbelklik het diagram om nodes en pijlen te bewerken.

```mermaid
flowchart LR
  start((start)) --> open[Open markdown]
  open --> render[Toon tekst en mermaid]
  render --> edit[Wijzig gerenderde tekst]
  edit --> save[Sla markdown op]
```

### Sequencediagram

```mermaid
sequenceDiagram
  participant A as Alice
  participant B as Bob
  A->>B: Hello
```

### Klassendiagram

```mermaid
classDiagram
  direction TB
  class Animal {
    +String name
    +eat()
  }
  class Duck
  class Flyer
  class Food
  Animal <|-- Duck
  Flyer <|.. Duck
  Duck ..> Food : eats
```

### C4 Context

```mermaid
C4Context
  title System context
  Person(user, "User", "A person")
  System(app, "App", "Does work")
  Rel(user, app, "Uses")
```
