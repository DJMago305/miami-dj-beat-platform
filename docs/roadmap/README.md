# Road Master Map

Mapa raíz del ecosistema Miami DJ Beat. **Se genera, no se escribe.**

El generador recorre el árbol del repositorio, clasifica cada archivo en su capa,
resuelve las sondas de verificación y reescribe la página completa. Ningún estado
de la página está tecleado a mano: si no hay archivo, no hay verde.

## Uso

```sh
node docs/roadmap/build.mjs          # regenera index.html  (~1 s)
node docs/roadmap/build.mjs --pdf    # además Road-Master-Map.pdf (Chrome headless)
```

Tras cada commit el hook `post-commit` regenera el HTML solo. Para incluir el PDF
en esa corrida: `ROADMAP_PDF=1 git commit …`

## Archivos

| Archivo | Rol |
|---|---|
| `master-map.json` | **Fuente.** Capas, reglas de clasificación, capacidades, capítulos, gráficos y sondas. |
| `build.mjs` | **Motor.** Descubrimiento, clasificación, verificación y render. Sin dependencias, sin red. |
| `post-commit.hook` | Copia versionada del bloque del hook (los hooks de git no se versionan). |
| `index.html` | Salida. Ignorada por git. |
| `Road-Master-Map.pdf` | Salida. Ignorada por git. |

## Cómo cambiarlo

- **Vigilar algo nuevo** → editar `master-map.json`. Nunca el HTML.
- **Cerrar un hallazgo** → arreglar el código; la sonda lo nota sola en la siguiente corrida.
- **Clasificar un archivo suelto** → añadir una regla a `classify`. Lo que ninguna regla
  captura aparece listado bajo «Sin clasificar» en vez de esconderse.

## Estados

| Estado | Significa |
|---|---|
| `VERIFIED` | Hay código de esa capacidad en el árbol. |
| `PROPOSED` | Hay documento y no hay código. |
| `UNKNOWN` | Ni una cosa ni la otra. |
| Conflicto | Un documento de la capacidad afirma inexistencia y su código sí existe. Es una **señal para revisar**, no un veredicto: la ficha cita la línea exacta. |

## Instalar el hook en una máquina nueva

```sh
cat docs/roadmap/post-commit.hook >> .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

## Límite conocido

La página publicada como Artifact **no consulta nada en vivo**: no hay base de datos
ni servicios detrás. Todo lo que muestra salió del repositorio en el momento de la
corrida indicada en la barra superior. Regenerar el archivo no actualiza el Artifact
publicado — eso requiere republicarlo.
