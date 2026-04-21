/**
 * 🔒 LOCKED MODULE — DO NOT MODIFY
 * 
 * Este archivo contiene la fuente de datos estática que resuelve el problema de carga (CORS).
 * 
 * Cualquier modificación puede romper:
 * - Render del catálogo
 * - Estabilidad offline
 * - Tiempo de carga
 * 
 * Solo modificar bajo instrucción directa del arquitecto del sistema.
 * 
 * STATUS: STABLE — PRODUCTION READY
 */
window.MDJ_RENTALS_DATA = {
  "horaLoca": [
    {
      "id": "hl_robot",
      "name": "Hora Loca Robot",
      "price": 650,
      "desc": "Show interactivo Miami-style (2 Personas: 1 Robot LED de última generación + 1 Asistente/Técnico CO2). Full energía para el clímax.",
      "video": "./assets/hora-loca/hora-loca-robot.mp4",
      "image": "",
      "active": true,
      "order": 1,
      "extras": [
        { "id": "hl_robot_ext1", "name": "Robot LED Adicional", "price": 450, "active": true, "order": 1 },
        { "id": "hl_robot_ext2", "name": "LED Drummer", "price": 350, "active": true, "order": 2 },
        { "id": "hl_robot_ext3", "name": "Pistola CO2 FX", "price": 100, "active": true, "order": 3 },
        { "id": "hl_robot_ext4", "name": "Performer LED", "price": 250, "active": true, "order": 4 }
      ]
    },
    {
      "id": "hl_brasil",
      "name": "Hora Loca Brasil",
      "price": 850,
      "desc": "Energía de carnaval VIP (4 Personas: 3 Bailarinas de Samba profesionales + 1 Baterista/Percusionista de Batucada en vivo).",
      "video": "./assets/hora-loca/hora-loca-brasil.mp4?v=20260414-under90mb",
      "image": "",
      "active": true,
      "order": 2,
      "extras": [
        { "id": "hl_brasil_ext1", "name": "Bailarina Brasil extra", "price": 250, "active": true, "order": 1 },
        { "id": "hl_brasil_ext2", "name": "Batucada full set", "price": 450, "active": true, "order": 2 },
        { "id": "hl_brasil_ext3", "name": "Animador de Samba", "price": 250, "active": true, "order": 3 }
      ]
    },
    {
      "id": "hl_cubana",
      "name": "Hora Loca Cubana",
      "price": 800,
      "desc": "Auténtico sabor tropical (4 Personas: 2 Bailarinas tradicionales + 2 Congueros/Músicos en vivo).",
      "video": "./assets/hora-loca/hora-loca-cubana.mp4",
      "image": "",
      "active": true,
      "order": 3,
      "extras": [
        { "id": "hl_cubana_ext1", "name": "Bailarina cubana extra", "price": 250, "active": true, "order": 1 },
        { "id": "hl_cubana_ext2", "name": "Músico extra", "price": 250, "active": true, "order": 2 },
        { "id": "hl_cubana_ext3", "name": "Percusión mayor", "price": 200, "active": true, "order": 3 }
      ]
    },
    {
      "id": "hl_character",
      "name": "Hora Loca Character",
      "price": 550,
      "desc": "Show temático a la carta (2 Personas: 2 Personajes/Zanqueros premium disfrazados estilo La Máscara, Celia Cruz, etc).",
      "video": "./assets/hora-loca/hora-loca-character.mp4",
      "image": "",
      "active": true,
      "order": 4,
      "extras": [
        { "id": "hl_char_ext1", "name": "Personaje extra", "price": 250, "active": true, "order": 1 },
        { "id": "hl_char_ext2", "name": "Zanquero animador", "price": 250, "active": true, "order": 2 },
        { "id": "hl_char_ext3", "name": "Host de Show", "price": 200, "active": true, "order": 3 }
      ]
    },
    {
      "id": "hl_hadas",
      "name": "Hora Loca Hadas",
      "price": 750,
      "desc": "Fantasía pura para bodas de lujo (3 Personas: 2 Hadas con alas LED + 1 Zanquero místico de fantasía).",
      "video": "./assets/hora-loca/hora-loca-hadas.mp4",
      "image": "",
      "active": true,
      "order": 5,
      "extras": [
        { "id": "hl_hadas_ext1", "name": "Hada extra", "price": 250, "active": true, "order": 1 },
        { "id": "hl_hadas_ext2", "name": "Alas LED especiales", "price": 100, "active": true, "order": 2 },
        { "id": "hl_hadas_ext3", "name": "Performer fantasy", "price": 250, "active": true, "order": 3 }
      ]
    }
  ],
  "talent": {
    "musicians": [
      {
        "id": "mus_sax",
        "name": "Saxofonista Live (Deep House)",
        "price": 450,
        "img": "./assets/brickell_featured.png",
        "desc": "Acompañamiento melódico para cócteles y cenas.",
        "active": true,
        "sortOrder": 1
      },
      {
        "id": "mus_timbal",
        "name": "Timbalero Pro (Open Format)",
        "price": 350,
        "img": "./assets/eventos-venues-patrocinadores/galeria/mojitos_featured.png",
        "desc": "Percusión en vivo para elevar la energía en la pista.",
        "active": true,
        "sortOrder": 2
      },
      {
        "id": "mus_singer",
        "name": "Cantante Lírica / Show Live",
        "price": 600,
        "img": "./assets/eventos-venues-patrocinadores/galeria/el_valle_featured.png",
        "desc": "Voz potente para momentos clave y ceremonias.",
        "active": true,
        "sortOrder": 3
      }
    ],
    "visuals": [
      {
        "id": "vis_photo",
        "name": "Fotografía Profesional (4h)",
        "price": 700,
        "img": "./assets/keys_featured.png",
        "desc": "Captura de alta fidelidad con retoque editorial.",
        "active": true,
        "sortOrder": 1
      },
      {
        "id": "vis_video",
        "name": "Videografía Highlight Reel",
        "price": 950,
        "img": "./assets/eventos-venues-patrocinadores/galeria/sundowners_featured.png",
        "desc": "Filmación 4K cinemática de los mejores momentos.",
        "active": true,
        "sortOrder": 2
      }
    ]
  }
};
