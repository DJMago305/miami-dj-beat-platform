# Separación de «Venues» — para que el PO compruebe que no falte nada
Fecha 2026-10-06 · Propuesta preparada por Claude · Nada se ha escrito en producción: se aplica con dos scripts que corre el PO, en este orden:
1. `supabase/scripts/20261006_network_limpieza_completa.sql` (lo que el PO ya aclaró uno por uno)
2. `supabase/scripts/20261006_network_separar_resto_venues.sql` (el resto, por reglas; **esto es lo que hay que revisar**)

**Regla del PO:** en «Venues» quedan solo los **dueños** de negocios; managers aparte; cada persona en su categoría.
Ya corridos antes: Seguridad (9, fuera de Venues), teléfono de Wendy, Julio Navarete.

## Qué queda en «Venues» (dueños)

### Dueños (se quedan) (2)

| Nombre | Lugar | Teléfono |
|---|---|---|
| Alex Salman | Mojito Calle 8 | (305) 803-3359 |
| Marcel | El Valle Restaurante | 3059046963 |

_(+ Henrry de Mojitobar y Fathy Dincer, dueños que ya estaban confirmados: son 4 en total.)_

## Lo que se va a otras pestañas

### Managers → «Managers» (22)
Incluye a los confirmados por el PO (**Mojitobar Invoice** = contacto de facturación de Mojitobar, para mandar propuestas; Murilo, Julio Navarete, Ruben, Elvis Marina, Jhonatan Tobar, Cesar Reyes) y los que dicen Manager/GM. **Chris GM** queda marcado «pendiente de prospección».
| Nombre | Lugar | Teléfono |
|---|---|---|
| Andres Manager | Mojitobar | 17867126459 |
| Annie Manager | Whiskey Joe,s Miami | +1 (305) 560-4000 |
| Beba Manager | La Cobacha | (786) 715-6074 |
| Bory Manager | Riviera Live | (786) 637-0271 |
| Cesar Reyes | Mojitobar | 7868999653 |
| Chino Manager | La Cueva del Pirata | 7869306396 |
| Chris GM General Manager | Mojitobar Sawgrass | +15619016440 |
| Elvis Marina | Miami Yacht Club | (754) 202-6959 |
| Gavy Manager | Whiskey Joes miami | 7874441211 |
| Jhonatan Tobar | Mojitobar | +1 (954) 260-7373 |
| Jose Manager | Hooters Bayside | (786) 832-8431 |
| Julio Navarete | Rio Grande Churrascaria (antes La Cueva del  | (786) 506-4893 |
| Laura Manager | Kanty Y Rico | +1 (330) 881-2608 |
| Luis Manager | Toreros Brasilian Churrascaria | 7863814433 |
| Micky Manager | Breakwater South Beach | (786) 718-8118 |
| Miguel Manager | La Cueva del Pirata | +1 (786) 280-4008 |
| Murillo Manager | Spice Resto Lounge | +13057881429 |
| Murilo | Spice Resto Lounger | 3056066850 |
| Omar Managar | La Cueva del Pirata | (786) 514-593 |
| Paulo Manager | Mogitobar Sawgras | 3059892895 |
| Rachel Manager | Toreros | 7863767310 |
| Ruben Manager Bar | Amsterdam | (954) 593-4169 |

### Bartenders → «Bartender» (5)
Nelson, Maghela y Evelio los confirmó el PO; **Mirian (Conga Bar)** también (el PO cree que ya se fue a Colombia). **Alexandra** y **Jessica Bartender**: lo dice su nombre/lugar, por confirmar. **Angel Y Magela** (Mojitobar Sawgrass): Magela es la misma Maghela bartender; Angel, su esposo, hoy es policía y antes fue bartender de Mojitos Bayside.
| Nombre | Lugar | Teléfono |
|---|---|---|
| Alexandra | Mojitobar Bar Tender | (305) 783-9555 |
| Evelio Olozabar | Conga Bar | +13057462379 |
| Jessica Bartender | Riviera Live | +13055903693 |
| Maghela Palmiery | Mojitobar | ‪+1 (786) 234‑8897‬ |
| Nelson | El Valle Restaurant | +17863074776 |

### Promotores → «Promotor» (2)

| Nombre | Lugar | Teléfono |
|---|---|---|
| Randdy Promotor Ok | La Cueva Del Pirata | (786) 397-4855 |
| Yesenia Promicion New York | Mojitobar Bayside | +14842588544 |

### Comida / Restaurantes → lista nueva «Comida / Restaurantes» (3)
Lugares para comer o encargar comida (no son personas).
| Nombre | Lugar | Teléfono |
|---|---|---|
| Rio Grande Churrascaria | Rio Grande Churrascaria (antes La Cueva del  | (305) 549-8202 |
| Sushi Bar De La 67 | — | (305) 821-2310 |
| Terraza | La Cueva del Pirata | 7863571220 |

### Contabilidad → lista nueva «Contabilidad» (1)
La contadora personal del PO. Ficha sensible.
| Nombre | Lugar | Teléfono |
|---|---|---|
| Sirley Contadora | Riviera Live Invoice | 3055723199 |

### Abogado y contador (buenos contactos, categoría propia)
- Humberto Abogado (Mojitobar) → lista nueva «Abogados» (dato del PO)
- Javier Contador (Mojitobar) → «Contabilidad» (propuesta, junto a Sirley)

### Cantante
- Widel Portal → «Cantante» (amigo de Marichal; dato del PO)

### Otros movimientos confirmados por el PO
- Frank Sonidista (CubaOcho) → «Sonidista»
- Pikolino (Show Event) → «Animador» (sale de «Cliente»)
- Jose Web Side → «Proveedores» (hace páginas web)
- Mario Valerio (Cachita Restaurante) → «Amigo»
- Dailyn (ex Mojitobar) → «Cliente» (salón de belleza/spa; le hizo fiestas privadas)

## Lo que queda por revisar: «Personal de venues» (lista nueva)
Gente que trabaja en un local pero **sin rol claro en su nombre** (no sabemos si bartender, mesero, seguridad…). Se saca de «Venues» y queda buscable por el lugar. **Dime cuáles son otra cosa** (bartender, seguridad, manager, dueño…) y los muevo.

### Personal de venues (68)

| Nombre | Lugar | Teléfono |
|---|---|---|
| Alain | Mojitobar Miami | (786) 724-7309 |
| Alejandro | El Yonky | (786) 537-9355 |
| Amanda | Mojitobar | 7868781292 |
| Anelim El Valle Restaurant | — | +17868633328 |
| Annie Duce | Whiskey Joe's Miami | — |
| Aura | Mojitobar Sawgrass | (954) 706-2367 |
| Benjamine Chaff | Mojitobar Fort laudardale | 2156059999 |
| Bernar | La Cueva del Pirata | 7865475772 |
| Boris | Spice Resto Lounge | — |
| Bory Representante | Kola Loka | 7868702848 |
| Catalina | Mojito Bar | 13053059129 |
| Cristian | Neme Bar | +13067631476 |
| Dago Pay Roll | Divino Pecado | (786) 658-7722 |
| Danny | Whiskey Joes | (786) 728-3616 |
| David | Edison South Beach | (786) 614-4028 |
| Eduardo Pino Targetas | La Cueva del Pirata | (786) 370-6436 |
| El Flaco | Mojitobar Bayside | (786) 910-4461 |
| Erick Padrino | Mojitobar | +17868383630 |
| Felix | Spice Resto Lounge | +13059728433 |
| Fonseca Suarez\\, | Las Vegas Restaurante | +17868496466 |
| Freddy | Mojitobar | 7865546528 |
| Gerardo Avila | Mojito Bar | +17869306370 |
| Gordo | Flavor Club | (786) 389-3965 |
| Gustavo | Mojitobar Bayside | 7868032982 |
| Jenifer | Mojitobar | (786) 803-7972 |
| Jorge Quesada | El Valle Restaurant | +17865564217 |
| Jorgito | Cafeteria Honda | 7865970989 |
| Juan J Alvarado | Caribe Restaurant | (786) 317-4273 |
| Julio  Bayside | Congabar | +17864885486 |
| Kamila | Conga Bar | (786) 939-6679 |
| Karen | Mojitobar | (786) 325-5794 |
| Lellany | Mojito Bar | 17863466149 |
| Lia Roman | La Cueva del Pirata | (786) 448-9413 |
| Lily | La Cueva Del Pirata | (786) 387-6870 |
| Lily | La Cueva Del Pirata | 7864910173 |
| Loida | La Cueva Del Pirata | +1 (305) 746-7247 |
| Luis Mojitobar | Boranica | (786) 281-7562 |
| Maikel | Mojitobar Bar | (786) 985-1121 |
| Maikel Cuba | Mojitobar Dontown | 7865324187 |
| Mario Boricua | Mojitobar | 3524335807 |
| Mary | La Cueva del Pirata | 7867201227 |
| Mayito Garcia Garcia | Mojito Bar - Bayside Marketplace | — |
| Nohamy | La Cueva del Pirata | 7866225322 |
| Party | Alexis Mojitobar | (305) 216-3199 |
| Raiskel Chef | La Cueva del Pirata | +1 (352) 834-5192 |
| Raulier | La Zona Cubana | (786) 568-5165 |
| Rey | Mojitobar Sawgrass | (954) 261-6231 |
| Richard Velezuela Amigo De Jhonatan | Divino pecado | +17863827797 |
| Roberto Demena | Ambar Motor | +1 (786) 503-5151 |
| Rolando | Congabar Lombardis | +17864222887 |
| Rosie Ramos | CubaOcho | +17869999216 |
| Sadier Padrino | Mojitobar | (786) 901-4261 |
| Saily | Mojitibar Bayside | (786) 659-5254 |
| Savier | Conga Bar | (305) 337-9492 |
| Sikiu | Mojitobar | 9545526946 |
| Wilfredo Figerodo Director Artistico | Riviera Live | +17867153329 |
| Wilfrido | Flavor Nigth Club | +1 (786) 444-0857 |
| Yaimy Cuba | Mojitobar | +17866367419 |
| Yeni Esposa De Cubita  Cuba | Mojitobar | +13052828317 |
| Yianko Rodriguez | Conga Bar | +13057619352 |
| Yoel | Habana Nice Hotel | (786) 390-4586 |
| Yunuo Mojito Bar | Jaz | (786) 250-9721 |
