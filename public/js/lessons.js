// lessons.js — All lesson content (offline, no API needed)

const LECCIONES = {
  Principiante: [
    { id:"p1", titulo:"Saludos básicos", descripcion:"Hello, Hi, Good morning…", xp:20,
      contenido:`Saludos formales:
• Hello → Hola  |  Good morning → Buenos días
• Good afternoon → Buenas tardes  |  Good night → Buenas noches

Saludos informales:
• Hi / Hey → Hola  |  What's up? → ¿Qué onda?
• How are you? → ¿Cómo estás?  |  I'm fine, thanks → Estoy bien

Despedidas:
• Bye / Goodbye → Chau  |  See you later → Nos vemos
• Take care → Cuídate  |  Have a good day → Buen día

📝 Ejercicio: Escribile un saludo a Alex como si lo encontraras por primera vez hoy.`,
      quiz:[
        {p:"¿Cómo se dice 'Buenos días' en inglés?",o:["Good night","Good morning","Good evening","Hello"],c:1},
        {p:"¿Qué significa 'How are you?'",o:["¿Cómo te llamás?","¿De dónde sos?","¿Cómo estás?","¿Cuántos años tenés?"],c:2},
        {p:"¿Cuál es la forma más informal de decir 'Hola'?",o:["Hello","Good morning","Hey","Greetings"],c:2},
        {p:"¿Cómo se dice 'Nos vemos después'?",o:["Goodbye","Take care","See you later","Good night"],c:2},
        {p:"'I'm fine, thanks' significa:",o:["Estoy cansado","Estoy bien, gracias","Mucho gusto","Hasta luego"],c:1},
      ]
    },
    { id:"p2", titulo:"El verbo To Be", descripcion:"I am, You are, He/She is…", xp:25,
      contenido:`El verbo To Be = ser / estar. El más importante del inglés.

Afirmativa:
I am / I'm → Yo soy  |  You are / You're → Vos sos
He is / He's → Él es  |  She is / She's → Ella es
We are / We're → Somos  |  They are / They're → Ellos son

Negativa: agrega "not"
I'm not → No soy  |  He isn't → Él no es

Preguntas: invertí el orden
Are you okay? → ¿Estás bien?  |  Is she your sister? → ¿Es tu hermana?

📝 Ejercicio: Escribí 3 oraciones sobre vos usando I am / I'm.`,
      quiz:[
        {p:"¿Cómo se dice 'Ella es mi amiga'?",o:["She am my friend","She is my friend","She are my friend","Her is my friend"],c:1},
        {p:"La contracción de 'I am' es:",o:["I'm","Im","I'am","Iam"],c:0},
        {p:"¿Cómo se hace una pregunta con To Be?",o:["You are okay?","Are you okay?","Is you okay?","Am you okay?"],c:1},
        {p:"'We are from Argentina' en negativo:",o:["We not are from Argentina","We are not from Argentina","We isn't from Argentina","We aren't from Argentina"],c:3},
        {p:"¿Cuál es la forma correcta?",o:["They is ready","They am ready","They are ready","They be ready"],c:2},
      ]
    },
    { id:"p3", titulo:"Números del 1 al 100", descripcion:"One, two, three… one hundred", xp:20,
      contenido:`Del 1 al 20:
1-one  2-two  3-three  4-four  5-five  6-six  7-seven  8-eight  9-nine  10-ten
11-eleven  12-twelve  13-thirteen  14-fourteen  15-fifteen
16-sixteen  17-seventeen  18-eighteen  19-nineteen  20-twenty

Decenas:
30-thirty  40-forty  50-fifty  60-sixty  70-seventy  80-eighty  90-ninety  100-one hundred

Combinaciones:
21 → twenty-one  |  45 → forty-five  |  99 → ninety-nine

En el negocio:
It costs fifty dollars → Cuesta $50
I have thirty products → Tengo 30 productos

📝 Ejercicio: ¿Cómo se dice 27, 53 y 88 en inglés?`,
      quiz:[
        {p:"¿Cómo se dice '15' en inglés?",o:["Fifty","Fiveteen","Fifteen","Fiftieth"],c:2},
        {p:"¿Cómo se escribe '40'?",o:["Fourty","Forty","Fourtee","Fority"],c:1},
        {p:"'Eighty-seven' es el número:",o:["78","87","88","76"],c:1},
        {p:"¿Cómo se dice 'Cuesta veinte dólares'?",o:["It costs twenty dollars","It cost twenty dollar","It costs twenty dollar","Its cost twenty dollars"],c:0},
        {p:"'Thirty-three' es:",o:["23","43","33","34"],c:2},
      ]
    },
    { id:"p4", titulo:"Presentarse en inglés", descripcion:"My name is, I'm from, I work…", xp:25,
      contenido:`Frases básicas:
My name is… → Mi nombre es…
I'm… → Soy… (informal)  |  Nice to meet you → Mucho gusto

De dónde sos:
I'm from Argentina → Soy de Argentina
I live in Buenos Aires → Vivo en Buenos Aires

Tu trabajo:
I own a business → Tengo un negocio
I'm an entrepreneur → Soy emprendedor/a

Edad: I'm 25 years old → Tengo 25 años

Ejemplo: "Hi! My name is Valentino. I'm from Argentina. I'm 25 and I own a business. Nice to meet you!"

📝 Ejercicio: Escribí tu propia presentación completa.`,
      quiz:[
        {p:"¿Cómo se dice 'Mi nombre es Ana'?",o:["My name are Ana","I name is Ana","My name is Ana","I'm name Ana"],c:2},
        {p:"'Nice to meet you' significa:",o:["Hasta luego","Mucho gusto","¿Cómo estás?","Bienvenido"],c:1},
        {p:"¿Cómo decís 'Soy de Argentina'?",o:["I am from of Argentina","I'm Argentina","I'm from Argentina","I come Argentina"],c:2},
        {p:"'I'm 30 years old' significa:",o:["Tengo 13 años","Tengo 30 años","Soy de los 30","Vivo hace 30 años"],c:1},
        {p:"'I own a business' significa:",o:["Busco un negocio","Vendo negocios","Tengo un negocio","Trabajo en negocios"],c:2},
      ]
    },
    { id:"p5", titulo:"Vocabulario esencial", descripcion:"Las palabras más usadas en inglés", xp:30,
      contenido:`Palabras básicas:
Yes/No/Maybe → Sí/No/Quizás  |  Please → Por favor  |  Thank you → Gracias
Sorry → Perdón  |  Help → Ayuda  |  Stop → Para  |  Go → Ir/Andá

Preguntas:
What? → ¿Qué?  |  Who? → ¿Quién?  |  Where? → ¿Dónde?
When? → ¿Cuándo?  |  Why? → ¿Por qué?  |  How? → ¿Cómo?
How much? → ¿Cuánto cuesta?

Tiempo:
Today/Yesterday/Tomorrow → Hoy/Ayer/Mañana
Now/Later → Ahora/Después  |  Always/Never/Sometimes → Siempre/Nunca/A veces

Colores: Red-rojo  Blue-azul  Green-verde  Yellow-amarillo  Black-negro  White-blanco

📝 Ejercicio: Usá 5 de estas palabras en oraciones propias.`,
      quiz:[
        {p:"¿Cómo se dice 'Por favor' en inglés?",o:["Thank you","Sorry","Please","Excuse me"],c:2},
        {p:"'How much?' pregunta sobre:",o:["Cantidad","Precio","Tiempo","Lugar"],c:1},
        {p:"'Yesterday' significa:",o:["Hoy","Mañana","Ayer","Después"],c:2},
        {p:"¿Cómo se dice 'A veces'?",o:["Always","Never","Sometimes","Usually"],c:2},
        {p:"'Blue' es el color:",o:["Rojo","Verde","Amarillo","Azul"],c:3},
      ]
    },
  ],
  Intermedio: [
    { id:"i1", titulo:"Presente simple", descripcion:"I work, She works, They play…", xp:35,
      contenido:`Cuándo usarlo: rutinas, hábitos, hechos permanentes.

Estructura:
Afirmativa: Sujeto + verbo (+ s en 3ra persona)
Negativa: Sujeto + don't / doesn't + verbo
Pregunta: Do / Does + sujeto + verbo?

Ejemplos:
I sell products every day → Vendo productos todos los días
She works in the morning → Ella trabaja por la mañana
I don't have time → No tengo tiempo
Do you have a store? → ¿Tenés una tienda?

Palabras clave: always, usually, often, sometimes, never, every day/week

📝 Ejercicio: Describí tu rutina de trabajo (mínimo 4 oraciones).`,
      quiz:[
        {p:"¿Cuál es correcta para 3ra persona?",o:["She work here","She works here","She working here","She do work here"],c:1},
        {p:"La negativa de 'I work' es:",o:["I not work","I don't work","I doesn't work","I no work"],c:1},
        {p:"¿Cómo se pregunta '¿Él trabaja acá?'",o:["He works here?","Does he work here?","Do he works here?","Is he work here?"],c:1},
        {p:"'She doesn't sell online' en afirmativo:",o:["She sells online","She do sell online","She selling online","She sold online"],c:0},
        {p:"¿Cuál palabra indica presente simple?",o:["Yesterday","Tomorrow","Every day","Right now"],c:2},
      ]
    },
    { id:"i2", titulo:"Pasado simple", descripcion:"I worked, She bought, They went…", xp:35,
      contenido:`Cuándo usarlo: acciones ya terminadas.

Verbos regulares: agrega -ed → work→worked  call→called  open→opened

Irregulares más usados:
go→went  |  buy→bought  |  sell→sold  |  have→had
make→made  |  come→came  |  see→saw  |  get→got

Ejemplos:
Yesterday I sold 10 products → Ayer vendí 10 productos
We had a great month → Tuvimos un mes excelente

Negativa: didn't + verbo base → I didn't sell anything → No vendí nada
Pregunta: Did + sujeto + verbo? → Did you make money?

📝 Ejercicio: Contá qué hiciste ayer en tu negocio.`,
      quiz:[
        {p:"¿Cuál es el pasado de 'buy'?",o:["Buyed","Buyd","Bought","Boughted"],c:2},
        {p:"La negativa de 'I went' es:",o:["I didn't went","I didn't go","I don't went","I not went"],c:1},
        {p:"¿Cómo se pregunta '¿Fuiste al mercado?'",o:["Did you go to the market?","You went to the market?","Did you went to the market?","Were you go to the market?"],c:0},
        {p:"El pasado de 'make' es:",o:["Maked","Makes","Made","Maden"],c:2},
        {p:"'She saw the client yesterday' significa:",o:["Ella verá al cliente mañana","Ella vio al cliente ayer","Ella ve al cliente siempre","Ella llamó al cliente ayer"],c:1},
      ]
    },
    { id:"i3", titulo:"Inglés para ventas", descripcion:"Frases clave para vender en inglés", xp:40,
      contenido:`Presentar un producto:
This product is… → Este producto es…
It helps you to… → Te ayuda a…
This is our best seller → Este es nuestro más vendido

Preguntar al cliente:
What are you looking for? → ¿Qué buscás?
What's your budget? → ¿Cuál es tu presupuesto?
Would you like to try it? → ¿Querés probarlo?

Manejar objeciones:
I understand your concern → Entiendo tu preocupación
Let me explain… → Dejame explicarte…

Cerrar la venta:
Shall we close the deal? → ¿Cerramos el trato?
I'll give you a discount → Te hago un descuento
It's a great investment → Es una gran inversión

📝 Ejercicio: Presentá un producto tuyo en inglés.`,
      quiz:[
        {p:"'What are you looking for?' pregunta:",o:["El precio","El presupuesto","Qué busca el cliente","Si quiere probar el producto"],c:2},
        {p:"¿Cómo se dice 'Cerramos el trato'?",o:["Let's close the deal","Shall we close the deal?","We close the deal","Close the deal now"],c:1},
        {p:"'I'll give you a discount' significa:",o:["No hay descuento","El precio es fijo","Te hago un descuento","El descuento ya aplicó"],c:2},
        {p:"Para manejar una objeción usás:",o:["Shall we close?","I understand your concern","What's your budget?","This is our best seller"],c:1},
        {p:"'This is our best seller' significa:",o:["Este es el más caro","Este es el más nuevo","Este es el más vendido","Este es el mejor precio"],c:2},
      ]
    },
    { id:"i4", titulo:"Emails en inglés", descripcion:"Cómo escribir emails profesionales", xp:40,
      contenido:`Estructura: 1. Saludo  2. Por qué escribís  3. Cuerpo  4. Cierre

Saludos: Dear Mr./Ms. [apellido] → formal  |  Hi [nombre] → informal

Frases útiles:
I'm writing to… → Le escribo para…
Could you please…? → ¿Podría por favor…?
Please find attached… → Adjunto encontrará…
I look forward to hearing from you → Quedo a la espera

Cierres:
Best regards → Saludos cordiales  |  Kind regards → Atentamente

Ejemplo: "Hi John, I'm writing to ask about your prices. Could you send me your catalogue? Best regards, Valentino."

📝 Ejercicio: Escribí un email a un proveedor pidiendo precios.`,
      quiz:[
        {p:"¿Cuál es el cierre más formal?",o:["Thanks","Bye","Kind regards","See you"],c:2},
        {p:"'I'm writing to…' se usa para:",o:["Despedirse","Presentarse","Explicar por qué escribís","Pedir un descuento"],c:2},
        {p:"¿Cómo se saluda formalmente en un email?",o:["Hey John","Hi there","Dear Mr. Smith","Hello buddy"],c:2},
        {p:"'Please find attached' indica:",o:["Que hay un archivo adjunto","Que el precio está adjunto","Que encontraste algo","Que adjuntás la respuesta"],c:0},
        {p:"'I look forward to hearing from you' significa:",o:["No espero tu respuesta","Quedo a la espera de tu respuesta","Escucho tu música","Miro hacia adelante"],c:1},
      ]
    },
  ],
  Avanzado: [
    { id:"a1", titulo:"Negociación en inglés", descripcion:"Negociar precios, condiciones y contratos", xp:50,
      contenido:`Abrir: I'd like to discuss the terms → Quiero hablar de los términos

Hacer ofertas:
We can offer you… → Podemos ofrecerte…
If you order more, we can lower the price → Si pedís más, bajamos el precio

Contraofertas:
That's a bit high for us → Eso es un poco alto para nosotros
Could you do better? → ¿Podría mejorar eso?
Let's meet in the middle → Encontrémonos en el medio

Cerrar:
We have a deal → Tenemos un trato
I'll send you the contract → Te mando el contrato
When can we start? → ¿Cuándo empezamos?

📝 Ejercicio: Hacé un roleplay de negociación con Alex.`,
      quiz:[
        {p:"'We have a deal' significa:",o:["Tenemos un problema","Tenemos un trato","Hacemos un trato","Hacemos negocios"],c:1},
        {p:"'Let's meet in the middle' propone:",o:["Reunirse en el centro","Llegar a un punto medio","Encontrarse a mitad de camino","Hablar en el centro"],c:1},
        {p:"¿Cómo propones bajar el precio si compran más?",o:["If you buy more, price go down","If you order more, we can lower the price","We lower price if more order","More order, less price"],c:1},
        {p:"'Could you do better?' es una:",o:["Oferta inicial","Contraoferta","Aceptación","Cierre"],c:1},
        {p:"'I'd like to discuss the terms' se usa para:",o:["Cerrar el trato","Rechazar la oferta","Abrir una negociación","Pedir un descuento"],c:2},
      ]
    },
    { id:"a2", titulo:"Presentaciones de negocio", descripcion:"Presentar tu negocio en inglés", xp:50,
      contenido:`Estructura: 1. Hook  2. El problema  3. Tu solución  4. Por qué vos  5. Call to action

Hook: Did you know that…? / Imagine a world where…

El problema: The main challenge is… / Most people struggle with…

Tu solución: We've developed… / Unlike competitors, we…

Call to action: Let's work together → Trabajemos juntos
Contact us today → Contactanos hoy

📝 Ejercicio: Prepará una presentación de 1 minuto de tu negocio.`,
      quiz:[
        {p:"¿Qué es un 'Hook' en una presentación?",o:["El cierre","La solución","Lo que engancha la atención","El problema"],c:2},
        {p:"'Unlike competitors, we…' sirve para:",o:["Criticar a la competencia","Diferenciarte de los competidores","Hablar del precio","Presentar el problema"],c:1},
        {p:"'Let's work together' es un:",o:["Hook","Call to action","Presentación del problema","Introducción"],c:1},
        {p:"¿Qué va después del Hook?",o:["La solución","El call to action","El problema","Por qué vos"],c:2},
        {p:"'Most people struggle with…' presenta:",o:["La solución","El equipo","El problema","El precio"],c:2},
      ]
    },
    { id:"a3", titulo:"Phrasal verbs de negocios", descripcion:"Los verbos compuestos más usados", xp:45,
      contenido:`Los phrasal verbs = verbo + preposición. Muy usados en inglés real.

Set up → Establecer (I set up my business last year)
Take over → Tomar control (They took over the company)
Scale up → Escalar (We need to scale up)
Cut down → Reducir (We cut down costs)
Follow up → Hacer seguimiento (I'll follow up with the client)
Break even → Cubrir costos (We finally broke even)
Run out of → Quedarse sin (We ran out of stock)
Put off → Posponer (Don't put off that meeting)
Turn down → Rechazar (They turned down our offer)
Come up with → Idear (She came up with a great plan)

📝 Ejercicio: Usá 5 phrasal verbs en oraciones sobre tu negocio.`,
      quiz:[
        {p:"'Follow up' en negocios significa:",o:["Seguir en redes","Hacer seguimiento","Seguir comprando","Seguir al cliente"],c:1},
        {p:"'We ran out of stock' significa:",o:["Corrimos al almacén","Nos quedamos sin stock","Llenamos el stock","Vendimos todo el stock"],c:1},
        {p:"'Put off' significa:",o:["Pagar","Posponer","Rechazar","Apagar"],c:1},
        {p:"'Break even' en negocios significa:",o:["Romper un acuerdo","Hacer una pausa","Cubrir los costos","Ganar mucho"],c:2},
        {p:"'She came up with a great plan' significa:",o:["Ella llegó con un plan","Ella ideó un gran plan","Ella siguió el plan","Ella vendió el plan"],c:1},
      ]
    },
  ],
};

const LECCIONES_MATE = {
  Básico: [
    { id:"m1", titulo:"Números y operaciones básicas", descripcion:"Suma, resta, multiplicación y división", xp:20,
      contenido:`Números naturales: 1, 2, 3, 4, 5… son los que usamos para contar.

Las 4 operaciones:
• Suma (+): 5 + 3 = 8 → Juntás cantidades
• Resta (-): 10 - 4 = 6 → Quitás cantidades
• Multiplicación (×): 4 × 3 = 12 → Suma repetida
• División (÷): 12 ÷ 4 = 3 → Repartís en partes iguales

En el negocio:
• Vendiste 5 remeras a $2000 → 5 × 2000 = $10.000
• Tenías $50.000 y gastaste $18.000 → 50.000 - 18.000 = $32.000
• 24 productos para 4 locales → 24 ÷ 4 = 6 por local

Orden de operaciones: paréntesis → potencias → × y ÷ → + y -
Ejemplo: 2 + 3 × 4 = 14 (NO 20)

📝 Ejercicio: Si vendés 8 productos a $1.500 y el costo fue $7.000, ¿cuánto ganás?`,
      quiz:[
        {p:"¿Cuánto es 15 × 4?",o:["54","60","45","70"],c:1},
        {p:"Vendiste 6 productos a $500 cada uno. ¿Cuánto juntaste?",o:["$2.500","$3.000","$3.500","$2.000"],c:1},
        {p:"¿Cuánto es 100 ÷ 5?",o:["15","25","20","30"],c:2},
        {p:"2 + 3 × 4 es igual a:",o:["20","14","18","12"],c:1},
        {p:"Tenías $80.000 y gastaste $35.000. ¿Cuánto te queda?",o:["$55.000","$40.000","$45.000","$50.000"],c:2},
      ]
    },
    { id:"m2", titulo:"Porcentajes", descripcion:"El % más útil para cualquier negocio", xp:25,
      contenido:`El porcentaje es una parte de 100. Es lo más usado en negocios.

¿Cómo calcular un porcentaje?
Fórmula: (porcentaje ÷ 100) × número
Ejemplo: 20% de $5.000 = 0.20 × 5.000 = $1.000

Casos más comunes:
Descuento: Precio - (% descuento × precio)
→ Remera $3.000 con 30% off = 3.000 - 900 = $2.100

Aumento: Precio × (1 + % aumento)
→ $1.000 con 15% = 1.000 × 1.15 = $1.150

IVA (21%): Precio × 1.21 → $1.000 + IVA = $1.210

Calcular qué % representa algo:
Fórmula: (parte ÷ total) × 100
→ $300 sobre $1.500 = (300 ÷ 1500) × 100 = 20%

📝 Ejercicio: Costó $2.000 y lo vendés a $3.000. ¿Qué % de ganancia tenés?`,
      quiz:[
        {p:"¿Cuánto es el 25% de $4.000?",o:["$800","$1.000","$1.200","$900"],c:1},
        {p:"Un producto de $5.000 tiene 20% de descuento. ¿Cuánto pagás?",o:["$3.500","$4.500","$4.000","$3.000"],c:2},
        {p:"Si comprás a $1.000 y vendés a $1.500, ¿qué % ganás?",o:["40%","60%","50%","45%"],c:2},
        {p:"¿Cuánto es el 10% de $7.500?",o:["$650","$750","$700","$800"],c:1},
        {p:"Sin IVA cuesta $2.000. Con IVA del 21% cuesta:",o:["$2.100","$2.420","$2.210","$2.300"],c:1},
      ]
    },
    { id:"m3", titulo:"Fracciones y decimales", descripcion:"Mitades, tercios, cuartos y números con coma", xp:20,
      contenido:`Fracciones: partes de un todo.
1/2 = 0.5  |  1/4 = 0.25  |  3/4 = 0.75  |  1/3 = 0.333…

Decimales: números con coma
0.5 = 50%  |  0.25 = 25%  |  1.5 = uno y medio

Operar:
2.5 + 1.3 = 3.8  |  4.0 - 1.7 = 2.3
3.5 × 2 = 7.0  |  9.0 ÷ 4 = 2.25

En el negocio:
• Media docena → × 0.5 o ÷ 2
• Ganancia 1.5 veces el costo → costo × 1.5
• Repartís ganancias en 3 → dividís por 3

📝 Ejercicio: Si tu ganancia por producto es $750 y vendés 8 productos, ¿cuánto ganás en total?`,
      quiz:[
        {p:"¿Cuánto es 1/4 en decimal?",o:["0.4","0.14","0.25","0.50"],c:2},
        {p:"¿Cuánto es 2.5 × 4?",o:["8","9","10","7"],c:2},
        {p:"3/4 equivale a qué porcentaje?",o:["34%","73%","70%","75%"],c:3},
        {p:"¿Cuánto es 7.5 ÷ 3?",o:["2","2.5","3","2.25"],c:1},
        {p:"Si tenés $1.000 y gastás la mitad, ¿cuánto te queda?",o:["$400","$600","$500","$450"],c:2},
      ]
    },
    { id:"m4", titulo:"Proporciones y regla de tres", descripcion:"Si X entonces Y, ¿y si tengo más?", xp:25,
      contenido:`La regla de tres sirve para calcular cantidades proporcionales.

Fórmula directa: Si A → B, entonces C → X = (C × B) ÷ A

Ejemplo: Si 5 productos cuestan $10.000, ¿cuánto cuestan 8?
X = (8 × 10.000) ÷ 5 = $16.000

Ejemplo inverso: Si 4 personas terminan en 6 días, ¿cuánto tardan 3?
X = (4 × 6) ÷ 3 = 8 días

En el negocio:
Si con $50.000 comprás 25 unidades, ¿cuántas comprás con $80.000?
X = (80.000 × 25) ÷ 50.000 = 40 unidades

📝 Ejercicio: Si 10 productos generan $15.000 de ganancia, ¿cuánto generan 35 productos?`,
      quiz:[
        {p:"Si 3 productos cuestan $6.000, ¿cuánto cuestan 7?",o:["$12.000","$14.000","$13.000","$15.000"],c:1},
        {p:"Si 1 empleado hace 15 cajas por hora, ¿cuántas hacen 4?",o:["45","50","60","55"],c:2},
        {p:"Con $20.000 comprás 10 unidades, ¿cuántas con $50.000?",o:["20","25","30","22"],c:1},
        {p:"5 trabajadores terminan en 8 días. ¿Cuánto tardan 10?",o:["4 días","6 días","3 días","5 días"],c:0},
        {p:"4 productos generan $2.000. ¿Cuánto generan 10?",o:["$4.000","$5.000","$6.000","$4.500"],c:1},
      ]
    },
  ],
  Intermedio: [
    { id:"m5", titulo:"Margen de ganancia", descripcion:"Cómo calcular cuánto ganás realmente", xp:35,
      contenido:`Ganancia bruta: Precio de venta - Costo
Ejemplo: Vendés a $5.000, costó $3.000 → Ganancia = $2.000

Margen (%): (Ganancia ÷ Precio de venta) × 100
(2.000 ÷ 5.000) × 100 = 40%

Markup (%): (Ganancia ÷ Costo) × 100
(2.000 ÷ 3.000) × 100 = 66.7%

¿Cuál usar?
• Margen → % de lo que vendés que es ganancia
• Markup → cuánto le sumás al costo

Fijar precio desde el margen:
Si querés 40% y el costo es $3.000:
Precio = 3.000 ÷ (1 - 0.40) = $5.000

Fijar precio desde el markup:
50% de markup sobre $3.000 = 3.000 × 1.50 = $4.500

📝 Ejercicio: Un producto cuesta $1.800. ¿A qué precio lo vendés para tener 40% de margen?`,
      quiz:[
        {p:"Comprás a $2.000 y vendés a $3.000. ¿Cuál es tu margen?",o:["33%","40%","50%","45%"],c:0},
        {p:"Si el costo es $5.000 y querés 50% de markup, ¿a qué precio vendés?",o:["$7.000","$7.500","$8.000","$6.500"],c:1},
        {p:"Ganancia $800, Precio $2.000. ¿Cuál es el margen?",o:["35%","40%","45%","30%"],c:1},
        {p:"Diferencia entre margen y markup:",o:["Son lo mismo","Margen sobre el precio, markup sobre el costo","Markup sobre el precio, margen sobre el costo","Ninguna"],c:1},
        {p:"Costo $3.000, margen 25%. ¿Cuál es el precio?",o:["$3.750","$4.000","$3.800","$4.200"],c:1},
      ]
    },
    { id:"m6", titulo:"Punto de equilibrio", descripcion:"¿Cuánto tenés que vender para no perder?", xp:35,
      contenido:`Punto de equilibrio: cuando ingresos = costos. Ni ganás ni perdés.

Costos fijos: alquiler, sueldos, servicios → no cambian
Costos variables: materia prima, empaques → cambian con la producción

Fórmula (en unidades):
PE = Costos Fijos ÷ (Precio de venta - Costo variable por unidad)

Ejemplo:
CF: $50.000  |  Precio: $5.000  |  CV: $3.000
Margen de contribución: 5.000 - 3.000 = $2.000
PE = 50.000 ÷ 2.000 = 25 unidades/mes

En pesos: 25 × 5.000 = $125.000

Para saber tu meta mínima de ventas cada mes.

📝 Ejercicio: CF $80.000, vendés a $4.000, CV $2.500. ¿Cuántas unidades necesitás?`,
      quiz:[
        {p:"¿Qué es el punto de equilibrio?",o:["Cuando ganás el máximo","Cuando ingresos = costos","Cuando vendés la mitad","Cuando cubrís solo costos variables"],c:1},
        {p:"CF $30.000, precio $3.000, CV $1.500. ¿Cuál es el PE?",o:["15 unidades","20 unidades","25 unidades","18 unidades"],c:1},
        {p:"¿Cuál es un costo fijo?",o:["Materia prima","Empaques","Alquiler","Comisiones"],c:2},
        {p:"Si el PE son 40 unidades y vendés 50, ¿qué significa?",o:["Estás perdiendo","Estás en equilibrio","Estás ganando","No se puede saber"],c:2},
        {p:"El margen de contribución es:",o:["Precio - Costo fijo","Precio - Costo variable","Ganancia total","Costo variable - Precio"],c:1},
      ]
    },
    { id:"m7", titulo:"Estadística básica", descripcion:"Promedio, mediana y datos para decidir mejor", xp:30,
      contenido:`Promedio: Suma ÷ Cantidad
Ventas: 10,15,8,20,12 → 65 ÷ 5 = 13/día

Mediana: valor del medio cuando los datos están ordenados
8,10,12,15,20 → Mediana = 12

Moda: el valor que más se repite
5,8,8,10,12,8 → Moda = 8

¿Cuándo usar cada uno?
• Promedio → rendimiento general
• Mediana → cuando hay valores extremos que distorsionan
• Moda → el producto más vendido, la hora pico, etc.

📝 Ejercicio: Ventas: $15.000, $22.000, $8.000, $18.000, $12.000, $25.000, $20.000. ¿Cuál es el promedio diario?`,
      quiz:[
        {p:"Ventas: 5,10,15,20,25. ¿Cuál es el promedio?",o:["13","14","15","16"],c:2},
        {p:"Datos: 3,7,9,12,18. ¿Cuál es la mediana?",o:["7","9","12","10"],c:1},
        {p:"Ventas: 4,6,6,8,6,10. ¿Cuál es la moda?",o:["4","8","6","10"],c:2},
        {p:"¿Cuándo conviene usar la mediana?",o:["Siempre","Cuando hay valores extremos","Cuando todos los datos son iguales","Nunca"],c:1},
        {p:"Si vendés 0,0,0,0,100 el promedio es 20. ¿Es representativo?",o:["Sí, siempre","No, la mediana sería más representativa","Sí, el promedio es siempre correcto","No importa"],c:1},
      ]
    },
  ],
  Negocios: [
    { id:"mn1", titulo:"Flujo de caja", descripcion:"Controlá cuánto entra y cuánto sale", xp:40,
      contenido:`Flujo de caja = Ingresos - Egresos

Ingresos: ventas en efectivo, cobros, préstamos recibidos
Egresos: mercadería, alquiler, servicios, sueldos, impuestos

Ejemplo mensual:
Ingresos: $200.000 + $30.000 = $230.000
Egresos: $100.000 + $40.000 + $30.000 = $170.000
Flujo = $230.000 - $170.000 = +$60.000 ✅

Si el resultado es negativo → gastás más de lo que entra 🚨

📝 Ejercicio: Vendiste $150.000, pagaste $80.000 CF y $40.000 mercadería. ¿Cuál es tu flujo?`,
      quiz:[
        {p:"¿Qué es el flujo de caja?",o:["Las ganancias del negocio","La diferencia entre ingresos y egresos","El dinero en caja","El capital del negocio"],c:1},
        {p:"Ingresos $300.000, egresos $250.000. ¿Cuál es el flujo?",o:["$50.000","$30.000","$40.000","$60.000"],c:0},
        {p:"Un flujo de caja negativo significa:",o:["El negocio crece","Ganás mucho","Gastás más de lo que entra","Estás en equilibrio"],c:2},
        {p:"¿Cuál de estos es un egreso?",o:["Venta en efectivo","Cobro de deuda","Pago de alquiler","Préstamo recibido"],c:2},
        {p:"¿Para qué sirve el flujo acumulado?",o:["Para saber el precio","Para ver la tendencia mes a mes","Para calcular el margen","Para fijar sueldos"],c:1},
      ]
    },
    { id:"mn2", titulo:"Rentabilidad y ROI", descripcion:"¿Vale la pena la inversión?", xp:45,
      contenido:`ROI = ((Ganancia - Inversión) ÷ Inversión) × 100

Ejemplo: Invertiste $50.000, vendiste por $80.000
Ganancia = $30.000
ROI = (30.000 ÷ 50.000) × 100 = 60%

¿Qué ROI es bueno?
• < 10% → bajo  |  10-30% → aceptable
• 30-50% → bueno  |  > 50% → excelente

ROI en publicidad:
$5.000 publicidad → $20.000 ventas adicionales
ROI = (15.000 ÷ 5.000) × 100 = 300%

Período de recupero: Inversión ÷ Ganancia mensual

📝 Ejercicio: Invertiste $100.000 en mejoras. Ventas aumentan $20.000/mes. ¿En cuántos meses recuperás?`,
      quiz:[
        {p:"Invertiste $20.000 y ganaste $30.000. ¿Cuál es el ROI?",o:["40%","50%","60%","45%"],c:1},
        {p:"Un ROI de 80% es:",o:["Bajo","Aceptable","Bueno","Excelente"],c:3},
        {p:"$10.000 publicidad → $25.000 adicionales. El ROI es:",o:["100%","150%","200%","250%"],c:1},
        {p:"¿Para qué sirve el período de recupero?",o:["Calcular el margen","Saber cuándo recuperás la inversión","Fijar precios","Calcular ROI"],c:1},
        {p:"Invertiste $50.000, ganás $10.000/mes. ¿En cuántos meses recuperás?",o:["3","4","5","6"],c:2},
      ]
    },
    { id:"mn3", titulo:"Proyecciones de ventas", descripcion:"Cómo proyectar el futuro de tu negocio", xp:40,
      contenido:`Proyección simple (crecimiento fijo):
Mes 1: $100.000 → con 10% mensual
Mes 2: $110.000  |  Mes 3: $121.000  |  Mes 4: $133.100

Proyección anual: Ventas mensuales × 12
$150.000/mes → $1.800.000 anuales

Meta regresiva (de atrás para adelante):
Querés ganar $500.000 con 40% de margen:
Ventas = 500.000 ÷ 0.40 = $1.250.000 anuales
Por mes = $104.167/mes

Siempre hacé 3 escenarios:
• Pesimista: -20%  |  Normal: lo esperado  |  Optimista: +20%

📝 Ejercicio: Querés ganar $200.000 netos en 6 meses con 30% de margen. ¿Cuánto vendés por mes?`,
      quiz:[
        {p:"Vendés $80.000 y crecés 10% mensual. ¿Cuánto el mes siguiente?",o:["$85.000","$88.000","$90.000","$82.000"],c:1},
        {p:"Ventas mensuales $200.000. ¿Cuánto proyectás en el año?",o:["$1.800.000","$2.000.000","$2.400.000","$2.200.000"],c:2},
        {p:"Querés ganar $600.000 con margen 25%. ¿Cuánto necesitás vender?",o:["$2.000.000","$2.400.000","$1.800.000","$2.200.000"],c:1},
        {p:"¿Por qué hacer 3 escenarios?",o:["Para confundirse","Para estar preparado para diferentes resultados","Es obligatorio","Para impresionar inversores"],c:1},
        {p:"La 'meta regresiva' sirve para:",o:["Calcular pérdidas","Partir de la ganancia deseada y calcular ventas","Proyectar el pasado","Calcular ROI"],c:1},
      ]
    },
  ],
};

const PLANTILLAS = {
  "📞 Guión de venta por WhatsApp": `Hola [Nombre]! 👋

Vi que podría interesarte [producto/servicio].

Te cuento en 3 líneas:
✅ [Beneficio 1]
✅ [Beneficio 2]
✅ [Beneficio 3]

Precio: [precio] — y si querés te hago una oferta especial esta semana.

¿Te mando más info o preferís que te llame?`,
  "💼 Pitch de ventas de 60 segundos": `Hola, soy [nombre] de [empresa/negocio].

Nos especializamos en ayudar a [tipo de cliente] a [resultado que logran].

Lo que nos diferencia es [tu diferencial único].

Trabajamos con clientes como [ejemplo] y logramos [resultado concreto].

Me gustaría saber si esto podría ser útil para vos. ¿Tenés 10 minutos esta semana?`,
  "📊 Plan de negocio simple": `PLAN DE NEGOCIO — [Nombre del negocio]

1. QUÉ VENDO
Producto/Servicio: [descripción]
Precio de venta: $[precio]   Costo: $[costo]   Ganancia: $[ganancia]

2. A QUIÉN LE VENDO
Cliente ideal: [descripción]
Problema que resuelvo: [describir]

3. CÓMO LO VENDO
Canales: WhatsApp / Instagram / Local / Mercado Libre

4. NÚMEROS DEL MES
Meta de ventas: [X] unidades
Ingresos esperados: $[monto]
Costos fijos: $[monto]
Ganancia esperada: $[monto]

5. PRÓXIMOS 3 PASOS
1. [Acción concreta]
2. [Acción concreta]
3. [Acción concreta]`,
  "📱 Bio para Instagram": `[NOMBRE DEL NEGOCIO] ✨
[Qué hacés en 1 línea]
📍 [Ciudad] | 🚚 Envíos a todo el país
💬 Escribinos por DM o WhatsApp
👇 Ver catálogo / Ver precios`,
  "📧 Email a proveedor": `Asunto: Consulta de precios — [tu nombre/empresa]

Estimado/a equipo de [Proveedor],

Mi nombre es [nombre] y represento a [tu negocio].

Estoy interesado/a en adquirir:
- [Producto 1]: [cantidad aproximada]
- [Producto 2]: [cantidad aproximada]

¿Podrían enviarme su lista de precios actualizada y condiciones de pago?

Saludos,
[Nombre]
[Teléfono] | [Email]`,
};

const ROLEPLAY_SITUACIONES = [
  { id:"r1", emoji:"✈️", titulo:"En el aeropuerto", desc:"Check-in, migraciones, preguntas básicas" },
  { id:"r2", emoji:"🤝", titulo:"Negociación con proveedor", desc:"Precios, condiciones, cierre de trato" },
  { id:"r3", emoji:"💼", titulo:"Entrevista de trabajo", desc:"Preguntas típicas de una entrevista en inglés" },
  { id:"r4", emoji:"🍽️", titulo:"En un restaurante", desc:"Pedir comida, preguntar al mozo, pagar" },
  { id:"r5", emoji:"🏪", titulo:"Atender a un cliente extranjero", desc:"Venderle algo a alguien que solo habla inglés" },
  { id:"r6", emoji:"📞", titulo:"Llamada de negocios", desc:"Concertar reuniones, presentarse por teléfono" },
  { id:"r7", emoji:"🛒", titulo:"Comprar en una tienda", desc:"Preguntar precios, tallas, disponibilidad" },
  { id:"r8", emoji:"🏨", titulo:"En el hotel", desc:"Check-in, pedir servicios, hacer reclamos" },
];
