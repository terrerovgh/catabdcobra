import type { Dict } from './index';

export const es: Dict = {
  meta: {
    title: 'Cat & Cobra Tattoo Studio — Albuquerque, NM',
    description:
      'Estudio de tatuajes personalizados en Albuquerque, Nuevo México. Anime, neotradicional, negro y gris, horror y cultura pop. Pasión. Arte. Precisión.',
  },
  nav: {
    home: 'Inicio',
    artists: 'Artistas',
    gallery: 'Galería',
    aftercare: 'Cuidados',
    booking: 'Reservar',
  },
  theme: {
    toggle: 'Cambiar de ánimo',
    cat: 'Modo gato',
    cobra: 'Modo cobra',
  },
  lang: {
    switchTo: 'English',
    label: 'Switch to English',
  },
  common: {
    bookNow: 'Reservar sesión',
    follow: 'Seguir',
    swipe: 'Desliza',
    comingSoon: 'Muy pronto',
  },
  home: {
    tagline: 'Pasión. Arte. Precisión.',
    heroTitle: 'Cat & Cobra',
    heroSub: 'Estudio de tatuajes · Albuquerque, NM',
    swipeCue: 'Desliza hacia arriba',
    aboutTitle: 'Suave por fuera, filo por dentro',
    aboutBody:
      'Cat & Cobra es un refugio seguro y amigable para tatuajes geniales, divertidos y nerds: fantasía, anime, neotradicional, cultura pop, negro y gris, y horror. Un estudio, dos espíritus: la calma del gato y el filo de la cobra.',
    stylesTitle: 'Estilos que dominamos',
    stylesSub: 'Desliza por el trabajo en el que nos especializamos',
    artistsTitle: 'Cinco artistas, cinco universos',
    artistsSub: 'Cada artista es un mundo propio. Encuentra el tuyo.',
    meetArtists: 'Conoce a los artistas',
    visitTitle: 'Ven a saludar',
    address: '301 Washington St SE, Albuquerque, NM 87108',
    visitBody: 'Citas y consultas: escríbenos y nos encargamos del resto.',
    ctaTitle: '¿Listo para tinta nueva?',
    ctaBody: 'Cuéntanos tu idea y te emparejamos con el artista indicado.',
  },
  artists: {
    title: 'Los artistas',
    sub: 'Desliza el mazo: cada tarjeta es un universo.',
    stylesLabel: 'Estilos',
    bookWith: 'Reserva con',
    owner: 'Dueño',
    resident: 'Artista residente',
  },
  gallery: {
    title: 'Galería',
    sub: 'Recién hecho vs curado: nuestro trabajo aguanta años.',
    filterStyle: 'Estilo',
    filterArtist: 'Artista',
    all: 'Todos',
    fresh: 'Recién hecho',
    healed: 'Curado',
    emptyTitle: 'Las fotos vienen en camino',
    emptyBody:
      'Estamos curando este portafolio ahora mismo. Mientras tanto, el trabajo más reciente vive en Instagram.',
    placeholderAlt: 'Foto de tatuaje muy pronto',
  },
  aftercare: {
    title: 'Cuidados',
    sub: 'Tu tatuaje es una herida con arte adentro. Protege la inversión.',
    tabTraditional: 'Tradicional',
    tabWrap: 'Vendaje dérmico',
    traditional: [
      {
        when: 'Horas 0–3',
        title: 'Retira y primer lavado',
        body: 'Quita el vendaje después de un par de horas. Lava con agua tibia y jabón líquido antibacterial sin perfume, enjuaga con agua fría y deja secar al aire.',
      },
      {
        when: 'Días 1–3',
        title: 'Lavar y capa fina',
        body: 'Lava 2–3 veces al día para que el plasma, la tinta y la sangre no se sequen en costras gruesas. Aplica una capa muy fina de ungüento o bálsamo libre de petróleo.',
      },
      {
        when: 'Días 4–14',
        title: 'Descamarse es normal',
        body: 'La descamación y la picazón leve significan que está sanando. Cambia a una loción sin perfume. Nunca rasques, nunca arranques.',
      },
      {
        when: 'Semana 2 en adelante',
        title: 'El largo plazo',
        body: 'Una vez sellado, el protector solar es el mejor amigo de tu tatuaje. Los rayos UV son la causa #1 del desvanecimiento prematuro.',
      },
    ],
    wrap: [
      {
        when: 'Días 1–3',
        title: 'Déjalo puesto',
        body: 'El vendaje adhesivo aísla la herida de bacterias, mascotas y roce. Mantenlo puesto un mínimo de 3 días.',
      },
      {
        when: 'Días 3–5',
        title: 'Retíralo en la ducha',
        body: 'Despégalo lentamente bajo agua tibia, hacia abajo y pegado a la piel — nunca lo arranques en seco. 5 días es el máximo.',
      },
      {
        when: 'Después de retirarlo',
        title: 'De vuelta a lo básico',
        body: 'Lava con suavidad, seca a toques y continúa con loción sin perfume hasta que asiente por completo.',
      },
    ],
    wrapNote:
      'La acumulación de fluido bajo el vendaje — plasma, tinta, un poco de sangre — se ve alarmante y es completamente normal.',
    wrapWarning:
      '¿Alergia a los adhesivos? Si ves enrojecimiento severo o inflamación en los bordes, retira el vendaje de inmediato y cambia al protocolo tradicional.',
    warningsTitle: 'Qué evitar',
    warnings: [
      { title: 'Agua estancada', body: 'Nada de piscinas, lagos, ríos ni jacuzzis hasta sanar por completo.' },
      { title: 'Pelo de mascota', body: 'Mantén la tinta fresca lejos de tus (adorables) compañeros peludos.' },
      { title: 'Gimnasios y mugre', body: 'Los equipos compartidos y el sudor son un buffet de bacterias. Espera.' },
      { title: 'Sol directo', body: 'Un tatuaje fresco se quema rápido y se apaga más rápido. Sombra hasta sanar, SPF para siempre.' },
    ],
    concernsTitle: 'Preocupaciones comunes',
    concerns: [
      {
        q: 'Está inflamado y adolorido. ¿Es normal?',
        a: 'Inflamación y molestia leve durante unos días es esperable. Los antiinflamatorios de venta libre ayudan. Si empeora en lugar de mejorar, contáctanos o consulta a un médico.',
      },
      {
        q: '¿Cuándo puedo usar loción normal?',
        a: 'Después de la primera semana, cambia a cualquier loción sin perfume cuando la piel se sienta tirante o seca.',
      },
      {
        q: 'Se descama y el color se ve opaco',
        a: 'Totalmente normal. El tatuaje está bajo una capa de piel en regeneración: el color vuelve cuando termina de asentarse.',
      },
      {
        q: '¿Cómo lo mantengo brillante por años?',
        a: 'Protector solar, hidratación y no rascar durante la curación. Las piezas de nuestros clientes siguen luciendo increíbles 12 años después.',
      },
    ],
  },
  booking: {
    title: 'Reserva tu sesión',
    sub: 'Tres pasos entre tú y tu nueva tinta.',
    steps: [
      { title: 'Elige a tu artista', body: 'Empareja tu idea con el artista cuyo universo le quede mejor.' },
      { title: 'Cuéntanos la idea', body: 'Tamaño, ubicación, referencias, color o negro y gris — cuanto más detalle, mejor.' },
      { title: 'Asegura tu fecha', body: 'Un depósito asegura tu cita y se descuenta del precio final de tu tatuaje.' },
    ],
    chooseArtist: '¿Quién es tu artista?',
    notSure: '¿No sabes? Te ayudamos a elegir',
    depositTitle: 'Depósitos',
    depositBody:
      'Se requiere un depósito no reembolsable de $100 para reservar. Se descuenta del precio final. Las tarifas y bloques de sesión varían según artista y proyecto.',
    contactTitle: 'Contacta al estudio',
    emailLabel: 'Escríbenos',
    instagramLabel: 'DM en Instagram',
    faqTitle: 'Bueno saberlo',
    faq: [
      {
        q: '¿Los retoques son gratis?',
        a: 'Los retoques son gratuitos con aprobación previa de tu artista — solo escríbenos con una foto del tatuaje curado.',
      },
      {
        q: '¿Cuánto costará mi tatuaje?',
        a: 'Depende del tamaño, el detalle y el artista. Hay bloques de medio día y día completo; tu artista te cotiza en la consulta.',
      },
      {
        q: '¿Aceptan walk-ins?',
        a: 'La disponibilidad cambia día a día — escríbenos por Instagram para confirmar.',
      },
    ],
  },
  footer: {
    address: '301 Washington St SE, Albuquerque, NM 87108',
    tagline: 'Pasión. Arte. Precisión.',
  },
};
