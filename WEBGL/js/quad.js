/*
 * Proyecto GPC Freestyle simulator
 *
 * Realizado por Jorge Rodríguez González
 * Curso 2026-2027
 * MIARFID UPV
 */


// Variables globales basicas de cualquier ejemplo Three.js del curso.
var renderer, scene, camera;
var cameraControls;
var clock = new THREE.Clock();
const stats = new Stats();

// Mundo fisico como en el seminario
var world;
const groundMaterial = new CANNON.Material("groundMaterial");
const quadMaterial = new CANNON.Material("quadMaterial");

// nave industrial
const ancho_nave = 90;
const largo_nave = 140;
const alto_nave = 20;
const canto_cercha = 0.8;
const flecha_cercha = 4;
const alto_zocalo = 3;
var MAT = {};//todos los materiales en un lugar

//rampas creadas, todos los perfiles para despues extrusionar

const RAMPAS = [
  { perfil: perfilQuarter(6, 98, 2), ancho: 30, x: 0, z: -65.5, rumbo: Math.PI },
  { perfil: perfilMesa(3, 7, 10, 14), ancho: 10, x: 0, z: -25 },
  { perfil: perfilKicker(7, 2.5), ancho: 6, x: 0, z: 3 },
  { perfil: perfilMesa(3, 1.5, 4, 14), ancho: 12, x: 0, z: 23 },
  { perfil: perfilQuarter(6, 98, 2), ancho: 30, x: 0, z: 65.5 },
  { perfil: perfilKicker(12, 5), ancho: 8, x: -28, z: -35 },
  { perfil: perfilMesa(5, 3, 6, 22), ancho: 10, x: -28, z: -4.5 },
  { perfil: perfilLineal(8, 2.6), ancho: 4.8, x: -34.75, z: 30 },
  { perfil: perfilSpine(5, 55), ancho: 12, x: 28, z: -30 },
  { perfil: perfilBaches(5, 4, 0.8), ancho: 8, x: 28, z: 0 },
  { perfil: perfilMesa(3, 1.5, 4, 14), ancho: 10, x: 28, z: 30, rumbo: Math.PI },
  { perfil: perfilKicker(7, 2.5), ancho: 6, x: 28, z: 50, rumbo: Math.PI },
  { perfil: perfilQuarter(5, 98, 1.5), ancho: 40, x: 41, z: 20, rumbo: Math.PI / 2 }
];

// para crear el quad/vehículo final
var quad = null;
var chassisBody = null;
var vehicle = null;
var ruedas = [];
const pos_inicial = new CANNON.Vec3(0, 1, -52);

// controles como en el tron, con awsd para mover, y flechas q y e para el aire
const controls = {
  acelerar: false, frenar: false, izquierda: false, derecha: false, freno: false,
  flipAdelante: false, flipAtras: false, sideIzq: false, sideDer: false,
  spinIzq: false, spinDer: false
};

// --- estado del quad ---
var ruedasEnSuelo = 4;//cuantos rayos de rueta tocan superficie, necesario para saber cuando estamos mal colocados, en el aire, etc
var chasisEnContacto = false;//para saber si nos caimos
var enElAire = false;//para los trucos
var tiempoVolcado = 0;//para enderezar automáticamente

// --- control aereo ---
const velGiroAire = 5.5;
const respuestaAire = 6;
const frenoGiroAire = 1.5;

// --- trucos ---
var saltando = false;
var tiempoEnAire = 0;
const giroAcum = new CANNON.Vec3();   // radianes girados en cada eje local, para detección de trucos
const margenVuelta = THREE.MathUtils.degToRad(60); // 300 grados ya es una vuelta, margen para cuando no aterrizas perfecto
var puntos = 0;
var temporizadorTruco = null;
const fuerzaMotor = 400;// N/m por rueda
const velocidadMax = 23;// m/s 
const fuerzaFreno = 5;
const giroMax = 0.65;// radianes que giran las ruedas delanteras
var direccion = 0;// giro actual

// spring camera, se calcula de forma separada
var velCamara = new THREE.Vector3();// velocidad de la camara
var rumbo = new THREE.Vector3(0, 0, 1);// hacia donde mira la camara
var objetivoCamara = new THREE.Vector3();// punto al que mira
const distancia_camara = 7;
const altura_camara = 2.8;
const rigidez = 60;// k del muelle entre la cámara y el vehículo
const amortiguamiento = 2 * Math.sqrt(rigidez); // para que llegue sin rigidez


const objetosCamara = [];// lo que la camara no puede atravesar, para el loop 
const raycasterCamara = new THREE.Raycaster();
var factorPared = 0;// 0 = camara normal, 1 = camara de pared, para loop y rampa de pared QPipe
const distanciaPared = 2.5;
const alturaPared = 3.5;

// texturas, luces,etc
const RUTA_TEXTURAS = 'WEBGL/images/nave/';
const materialesPBR = [];
var maxAnisotropia = 1;// se usa para cuando la camara mira el suelo desde muy abajo en tercera persona
var esHDR = false;
var gestorCarga = null;//para avisar cuando se han cargado todas las texturas
var texturasListas = false;

// luces: solo el foco de seguimiento proyecta sombras
var focoSeguimiento, luzRelleno, luzClaraboyas, luzLamparas;
var pasoGamma;
const ajustesLuz = { reflejos: 1.0, sombras: true };

// suelo con textura de cuadricula, ajustado a mano por la textura concreta que se usa
const CUADROS_IMAGEN = 3;//cuadros de la textura usada
const TAM_CUADRO = 10;
const TAM_IMAGEN_SUELO = CUADROS_IMAGEN * TAM_CUADRO;
const GIRAR_SUELO = true;//giro aleatorio del suelo para evitar ver patrones

// textura de la chapa de las paredes
const TAM_TEXTURA_PARED = 4;
// tamano de la greca de las paredes
const PASO_GRECA = 2.5;
const PROF_GRECA = 0.25;

var semillaAzar = 20261016;//semilla para los giros aleatorios en texturas cuadradas para evitar patrones

// modelo del quad/vehículo
const RUTA_MODELO = 'WEBGL/models/quad/scene.gltf';
const LARGO_QUAD = 3;
const MODELO_AL_REVES = true;//cambiar en función de cómo viene orientado el modelo que se use

// Parametros de la suspension
const ALTO_ANCLAJE = 0.15;
const SUSPENSION_REPOSO = 0.4;
const RIGIDEZ_SUSPENSION = 45;
// compresión de la suspensión
const SUSPENSION_CARGADA = SUSPENSION_REPOSO - 9.8 / (4 * RIGIDEZ_SUSPENSION);

// para reflejo del vehículo en el loop
var sondaRizo = null;
const DIST_SONDA = 14;// a más distancia casi no se puede apreciar, no lo calculamos
const FRAMES_SONDA = 3;//cada cuanto se actualiza

// postprocesado como en tron versión definitiva
var composer, bloomPass;
var panel = null, panelVisible = false;

// marcas de neumatico: buffer circular como el halo del Tron
const MAX_MARCAS = 1500;
const VIDA_MARCA = 25;//segundos de vida
const ANCHO_MARCA = 0.26;
const geoMarcas = new THREE.BufferGeometry();
const posMarcas = new Float32Array(MAX_MARCAS * 4 * 3);
const colMarcas = new Float32Array(MAX_MARCAS * 4 * 4);
const nacimientoMarca = new Float32Array(MAX_MARCAS).fill(-1e9);
var siguienteMarca = 0, marcasUsadas = 0;
var tiempoJuego = 0, acumuladorFade = 0;
const estelaRueda = [];
var impactoFuerte = 0;//para marcar el suelo cuando caemos
var velCaida = 0;

// juego: tiempo, categorías, medallas
const DURACION_SESION = 180;   // 3 minutos
var estado = 'menu';           // 'menu' | 'jugando'
var tiempoRestante = DURACION_SESION;
var anguloMenu = 0;
const CATEGORIAS = [
  { min: 60000, nombre: 'LEYENDA', medalla: 'ORO', color: '#ffcc33' },
  { min: 35000, nombre: 'PROFESIONAL', medalla: 'PLATA', color: '#d7dde3' },
  { min: 15000, nombre: 'AMATEUR', medalla: 'BRONCE', color: '#d08a4a' },
  { min: 0, nombre: 'ROOKIE', medalla: 'SIN MEDALLA', color: '#8a96a3' }
];
//teclas que se usan
const TECLAS = {
  KeyW: 'acelerar', KeyS: 'frenar',
  KeyA: 'izquierda', KeyD: 'derecha',
  Space: 'freno',
  ArrowUp: 'flipAdelante', ArrowDown: 'flipAtras',
  ArrowLeft: 'sideIzq', ArrowRight: 'sideDer',
  KeyQ: 'spinIzq', KeyE: 'spinDer'
};
//como en tron
document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyG' && !event.repeat) { alternarPanel(); return; }
  if (estado === 'menu') {
    if (event.code === 'Enter' && texturasListas) empezarSesion();
    return;                                   // en el menu no se conduce
  }
  if (event.code === 'Escape') { terminarSesion(); return; }
  var accion = TECLAS[event.code];
  if (accion) { controls[accion] = true; event.preventDefault(); }
  if (event.code === 'KeyR' && !event.repeat) enderezarQuad();
  if (event.code === 'KeyT' && !event.repeat) reiniciarQuad();
});

document.addEventListener('keyup', (event) => {
  var accion = TECLAS[event.code];
  if (accion) controls[accion] = false;
});

init();
loadScene();
render();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;//sombras
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  esHDR = renderer.capabilities.isWebGL2;
  maxAnisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = colorSRGB(0x0d0f12);
  scene.fog = new THREE.Fog(colorSRGB(0x0d0f12), 50, 170);
  crearLuces();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000);
  camera.position.set(0, 4, -36);

  cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
  cameraControls.enabled = false; // para mover la cámara nosotros

  // Mundo fisico como en el seminario
  world = new CANNON.World();
  world.gravity.set(0, -9.8, 0);
  // como se comportan los materiales entre si
  world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, quadMaterial,
    { friction: 0.1, restitution: 0.1 }));

  // STATS
  stats.showPanel(0);
  document.getElementById('container').appendChild(stats.domElement);


  // cargamos texturas con gestor, al terminar capturamos el entorno para reflejos estáticos en superficies metálicas
  gestorCarga = new THREE.LoadingManager();
  gestorCarga.onProgress = function (url, cargados, total) {
    textoEmpezar('Cargando texturas… ' + Math.round(cargados / total * 100) + '%');
  };
  gestorCarga.onLoad = function () {
    capturarEntorno();
    capturarSondaRizo(false);
    texturasListas = true;
    textoEmpezar('Pulsa <b>ENTER</b> para empezar · sesión de 3:00');
  };

  crearPostprocesado();
  crearPanel();

  window.addEventListener('resize', updateAspectRatio);
}


//luces, solo el foco que sigue produce sombras, para poder verlas siempre
function crearLuces() {
  // ambiente
  luzRelleno = new THREE.HemisphereLight(colorSRGB(0xdfe9ff), colorSRGB(0x403c38), 0.5);
  scene.add(luzRelleno);

  //de las claraboyas del techo
  luzClaraboyas = new THREE.DirectionalLight(colorSRGB(0xe8f1ff), 0.45);
  luzClaraboyas.position.set(-20, 40, 10);
  scene.add(luzClaraboyas);


  //simulamos las tiras led del techo con una sola direccional
  luzLamparas = new THREE.DirectionalLight(colorSRGB(0xfff8ee), 0.5);
  luzLamparas.position.set(0, 1, 0);
  scene.add(luzLamparas);

  //foco que sigue al vehículo, produce sombras
  focoSeguimiento = new THREE.SpotLight(colorSRGB(0xfff4e0), 0.5, 0, 0.42, 0.6, 1);
  focoSeguimiento.castShadow = true;
  focoSeguimiento.shadow.mapSize.set(1024, 1024);
  focoSeguimiento.shadow.camera.near = 2;
  focoSeguimiento.shadow.camera.far = 45;
  focoSeguimiento.shadow.bias = -0.0005;
  focoSeguimiento.shadow.normalBias = 0.02;
  scene.add(focoSeguimiento);
  scene.add(focoSeguimiento.target);
}

//para manejar el foco
function actualizarFoco() {
  var p = chassisBody.position;
  focoSeguimiento.position.set(p.x + 4, alto_nave - 1, p.z - 6);
  focoSeguimiento.target.position.set(p.x, p.y, p.z);
}

//postprocesado como el del tron versión final, con HDR y ajuste gamma

// mismo contenido que GammaCorrectionShader.js de three r140
function crearShaderGamma() {
  return {
    uniforms: { tDiffuse: { value: null }, exposicion: { value: 1.0 } },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform float exposicion;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec4 tex = texture2D(tDiffuse, vUv);',
      // exposicion: como en una camara, multiplica toda la luz antes de pasar a sRGB
      '  gl_FragColor = LinearTosRGB(vec4(tex.rgb * exposicion, tex.a));',
      '}'
    ].join('\n')
  };
}

function crearPostprocesado() {
  var rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: esHDR ? THREE.HalfFloatType : THREE.UnsignedByteType
  });
  composer = new THREE.EffectComposer(renderer, rt);
  if (esHDR) composer.renderTarget1.samples = composer.renderTarget2.samples = 4;

  composer.addPass(new THREE.RenderPass(scene, camera));

  // como en el pdf
  bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.1,//fuerza
    0.2,// radio
    esHDR ? 1.0 : 0.85//umbral para lamparas
  );
  composer.addPass(bloomPass);

  pasoGamma = new THREE.ShaderPass(crearShaderGamma());
  composer.addPass(pasoGamma);
}

//para ajustar el bloom, solo para desarrollo
function crearPanel() {
  panel = new dat.GUI();
  var carpetaBloom = panel.addFolder('Bloom');
  carpetaBloom.add(bloomPass, 'enabled').name('Activado');
  carpetaBloom.add(bloomPass, 'strength', 0, 3).step(0.05).name('Fuerza');
  carpetaBloom.add(bloomPass, 'radius', 0, 1).step(0.01).name('Radio');
  carpetaBloom.add(bloomPass, 'threshold', 0, 2).step(0.01).name('Umbral');
  carpetaBloom.open();

  var carpetaLuz = panel.addFolder('Luces');
  carpetaLuz.add(focoSeguimiento, 'intensity', 0, 4).step(0.05).name('Foco');
  carpetaLuz.add(luzRelleno, 'intensity', 0, 2).step(0.05).name('Relleno');
  carpetaLuz.add(luzClaraboyas, 'intensity', 0, 2).step(0.05).name('Claraboyas');
  carpetaLuz.add(luzLamparas, 'intensity', 0, 2).step(0.05).name('Lamparas techo');
  carpetaLuz.add(pasoGamma.uniforms.exposicion, 'value', 0.5, 2.5).step(0.05).name('Exposicion');
  carpetaLuz.add(ajustesLuz, 'reflejos', 0, 2).step(0.05).name('Reflejos')
    .onChange(function (v) { materialesPBR.forEach(function (m) { m.envMapIntensity = v; }); });
  carpetaLuz.add(ajustesLuz, 'sombras').name('Sombras')
    .onChange(function (v) { focoSeguimiento.castShadow = v; });
  carpetaLuz.open();

  panel.hide();
}

function alternarPanel() {
  panelVisible = !panelVisible;
  if (panelVisible) panel.show(); else panel.hide();
}

//reflejos como en el s5 cubemap, pero con una cubecamara que hace una foto única que es lo que reflejan los metales
function capturarEntorno() {
  var destino = new THREE.WebGLCubeRenderTarget(256, {
    type: esHDR ? THREE.HalfFloatType : THREE.UnsignedByteType
  });
  var cubeCamera = new THREE.CubeCamera(0.5, 200, destino);
  cubeCamera.position.set(0, 6, 0);
  var niebla = scene.fog;
  scene.fog = null;
  quad.visible = false;
  ruedas.forEach(function (r) { r.visible = false; });
  cubeCamera.update(renderer, scene);
  quad.visible = true;
  ruedas.forEach(function (r) { r.visible = true; });
  scene.fog = niebla;

  // PMREM prepara el cubemap para cada rugosidad: nitido para el metal, borroso para el hormigon
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(destino.texture).texture;   // envMap de todos los MeshStandard
  pmrem.dispose();
  destino.dispose();
}

// ======================================================================
// COLORES Y TEXTURAS
// ======================================================================

// Los colores se escriben en sRGB y se pasan a lineal, el ajuste gamma los devuelve
function colorSRGB(hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

function cargarTextura(ruta, repeat, esColor, alFallar, envoltura) {
  var t = new THREE.TextureLoader(gestorCarga).load(ruta, undefined, undefined, function () {
    console.warn('Falta la textura ' + ruta + ': se usa el color de respaldo');
    alFallar();
  });
  t.wrapS = t.wrapT = envoltura || THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = maxAnisotropia;//propiedad adicional para el suelo de lejos
  if (esColor) t.encoding = THREE.sRGBEncoding;
  return t;
}

// Material PBR a partir de RUTA_TEXTURAS/<nombre>_color|_normal|_rough.jpg
function materialPBR(nombre, tile, respaldo, opciones) {
  var o = Object.assign({ roughness: 1, metalness: 0 }, opciones || {});
  var envoltura = o.espejo ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  var relieve = o.relieve !== undefined ? o.relieve : 1;
  delete o.espejo;
  delete o.relieve;
  if (typeof o.color === 'number') o.color = colorSRGB(o.color);//tinte que multiplica la textura, para usar misma textura en los contenedores
  o.envMapIntensity = ajustesLuz.reflejos;
  o.normalScale = new THREE.Vector2(relieve, relieve);
  var m = new THREE.MeshStandardMaterial(o);

  var r = 1 / tile, base = RUTA_TEXTURAS + nombre;
  m.map = cargarTextura(base + '_color.jpg', r, true, function () {
    m.map = null; m.color = colorSRGB(respaldo); m.needsUpdate = true;
  }, envoltura);
  m.normalMap = cargarTextura(base + '_normal.jpg', r, false, function () {
    m.normalMap = null; m.needsUpdate = true;
  }, envoltura);
  m.roughnessMap = cargarTextura(base + '_rough.jpg', r, false, function () {
    m.roughnessMap = null; m.needsUpdate = true;
  }, envoltura);
  materialesPBR.push(m);
  return m;
}

//num aleatorios con semilla fija
function azar() {
  semillaAzar = (semillaAzar * 16807) % 2147483647;
  return (semillaAzar - 1) / 2147483646;
}

// Desplaza las UV de una geometria una distancia al azar, para evitar patrones
function desplazarUV(geo) {
  var uv = geo.attributes.uv, du = azar() * 50, dv = azar() * 50;
  for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  uv.needsUpdate = true;
  return geo;
}

// para poder usar misma textura en tamaños físicos distintos
function uvsEnMetros(geo) {
  var pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (var i = 0; i < pos.count; i++) {
    var nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (nx >= ny && nx >= nz) uv.setXY(i, z, y);
    else if (ny >= nz) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  return geo;
}

function loadScene() {
  crearMateriales();
  crearSueloNave();
  crearParedesNave();
  crearEstructuraNave();
  crearContenedores();
  RAMPAS.forEach(construirRampa);
  construirRizo({ x: -12, z: 20, radio: 5, ancho: 5, desp: -6.5 });
  crearQuad();
  crearMarcas();
}
//funciones auxiliares, la de los bordes es del seminario de tron, las otras 2 nuevas
// copiada de tron-v1.js: dibuja las aristas de un mesh como lineas
function agregarBordes(mesh, colorBorde) {
  var bordes = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 25),
    new THREE.LineBasicMaterial({ color: colorSRGB(colorBorde) })
  );
  mesh.add(bordes);
  return bordes;
}

// cuerpo fisico estatico con forma de caja con cannon
function cuerpoCaja(hx, hy, hz, x, y, z, rotY) {
  var b = new CANNON.Body({ mass: 0, material: groundMaterial });
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
  b.position.set(x, y, z);
  if (rotY) b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
  world.addBody(b);
  return b;
}

//prismas para las rampas compactas, si no se crean esquinas y las colisiones funcionan mal
function crearConvexo(vertices, caras) {
  if (CANNON.version) return new CANNON.ConvexPolyhedron(vertices, caras);
  return new CANNON.ConvexPolyhedron({ vertices: vertices, faces: caras });
}
function anadirPrisma(cuerpo, poligono, xCentro, ancho) {
  var n = poligono.length;

  var area = 0;
  for (var a = 0; a < n; a++) {
    var b = (a + 1) % n;
    area += poligono[a][0] * poligono[b][1] - poligono[b][0] * poligono[a][1];
  }
  if (area < 0) poligono = poligono.slice().reverse();

  var cz = 0, cy = 0;
  for (var k = 0; k < n; k++) { cz += poligono[k][0]; cy += poligono[k][1]; }
  cz /= n; cy /= n;

  var verts = [], caras = [], izq = [], der = [];
  for (k = 0; k < n; k++) verts.push(new CANNON.Vec3(-ancho / 2, poligono[k][1] - cy, poligono[k][0] - cz));
  for (k = 0; k < n; k++) verts.push(new CANNON.Vec3(ancho / 2, poligono[k][1] - cy, poligono[k][0] - cz));

  // tapa izquierda (normal -X) en el orden del poligono; la derecha (+X) al reves
  for (k = 0; k < n; k++) { izq.push(k); der.push(2 * n - 1 - k); }
  caras.push(izq, der);
  // una cara lateral por cada lado del poligono
  for (k = 0; k < n; k++) {
    var s = (k + 1) % n;
    caras.push([k, n + k, n + s, s]);
  }
  cuerpo.addShape(crearConvexo(verts, caras), new CANNON.Vec3(xCentro, cy, cz));
}

// textura de rayas de seguridad dibujada con canvas: no necesita textura
function crearTexturaRayas() {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  var g = c.getContext('2d');
  g.fillStyle = '#111111';
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#ffb000';
  for (var i = -2; i < 6; i++) {
    g.beginPath();
    g.moveTo(i * 32, 32);
    g.lineTo(i * 32 + 16, 32);
    g.lineTo(i * 32 + 48, 0);
    g.lineTo(i * 32 + 32, 0);
    g.closePath();
    g.fill();
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.encoding = THREE.sRGBEncoding;
  return t;
}


//materiales
function crearMateriales() {
  MAT.suelo = materialPBR('suelo_cuadricula', TAM_IMAGEN_SUELO, 0x8a8d90, { roughness: 0.85 });
  var anisoSuelo = Math.min(8, renderer.capabilities.getMaxAnisotropy());//para cuando lo ves de lejos y abajo
  [MAT.suelo.map, MAT.suelo.normalMap, MAT.suelo.roughnessMap].forEach(function (t) { t.anisotropy = anisoSuelo; });
  MAT.hormigon = materialPBR('hormigon_pared', 6, 0x8d8f91, { espejo: true });
  MAT.chapa = materialPBR('chapa_pared', TAM_TEXTURA_PARED, 0xb8bec5, { metalness: 0.6, roughness: 0.6, relieve: 0.5 });
  MAT.acero = materialPBR('metal_pintado', 3, 0x9aa1aa, { color: 0xb4bbc4, metalness: 0.7, roughness: 0.45, relieve: 0.4, espejo: true });
  MAT.techo = materialPBR('metal_pintado', 8, 0x5d636b, { color: 0x6b7178, metalness: 0.4, roughness: 0.7, relieve: 0.3, espejo: true });
  MAT.rampa = materialPBR('contrachapado', 2.44, 0x9a7a55, { roughness: 0.8 });   // tablero real de 2.44 m
  MAT.rizo = materialPBR('chapa_estriada', 1.2, 0xc0c4c8, { color: 0xe8ebee, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide });
  MAT.contRojo = materialPBR('contenedor', 2.5, 0x9c3f2a, { color: 0xb04a32, metalness: 0.2, roughness: 0.7 });
  MAT.contAzul = materialPBR('contenedor', 2.5, 0x335f90, { color: 0x3a6fa8, metalness: 0.2, roughness: 0.7 });
  MAT.contGris = materialPBR('contenedor', 2.5, 0x8a9096, { color: 0x9aa0a6, metalness: 0.2, roughness: 0.7 });

  // pintura de seguridad del suelo: recibe luz y sombra; polygonOffset evita el z-fighting
  MAT.lineaSuelo = new THREE.MeshStandardMaterial({
    color: colorSRGB(0xffb000), roughness: 0.6,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });

  // EMISIVOS: valores por encima de 1 (HDR). Son lo unico que supera el umbral
  // del bloom: por eso brillan las lamparas y no el hormigon iluminado.
  MAT.lampara = new THREE.MeshBasicMaterial({ color: colorSRGB(0xffffff).multiplyScalar(4) });
  MAT.claraboya = new THREE.MeshBasicMaterial({ color: colorSRGB(0xcfe6ff).multiplyScalar(1.6) });
  MAT.led = new THREE.MeshBasicMaterial({ color: colorSRGB(0x5ff2ff).multiplyScalar(3) });
}
// suelo, con repetición girada aleatoriamente para que no se vean patrones por las marcas del hormigón
function crearGeometriaSuelo() {
  var posiciones = [], normales = [], uvs = [], indices = [];
  var t = TAM_IMAGEN_SUELO;
  var nx = Math.ceil(ancho_nave / t), nz = Math.ceil(largo_nave / t);
  var x0 = -nx * t / 2, z0 = -nz * t / 2;

  for (var i = 0; i < nx; i++) {
    for (var j = 0; j < nz; j++) {
      var giro = GIRAR_SUELO ? Math.floor(azar() * 4) : 0;
      var base = posiciones.length / 3;
      [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(function (e) {
        posiciones.push(x0 + (i + e[0]) * t, 0, z0 + (j + e[1]) * t);
        normales.push(0, 1, 0);
        var u = e[0] * t, v = e[1] * t, tmp;
        for (var k = 0; k < giro; k++) { tmp = u; u = v; v = t - tmp; }
        uvs.push(u, v);
      });
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}
//para crearlo
function crearSueloNave() {
  var suelo = new THREE.Mesh(crearGeometriaSuelo(), MAT.suelo);
  suelo.receiveShadow = true;
  scene.add(suelo);

  // linea amarilla de seguridad a 2.5 m de las paredes
  var m = 2.5, g = 0.15;
  var lineas = [
    [ancho_nave - 2 * m, g, 0, largo_nave / 2 - m],
    [ancho_nave - 2 * m, g, 0, -largo_nave / 2 + m],
    [g, largo_nave - 2 * m, ancho_nave / 2 - m, 0],
    [g, largo_nave - 2 * m, -ancho_nave / 2 + m, 0]
  ];
  lineas.forEach(function (l) {
    var linea = new THREE.Mesh(new THREE.PlaneGeometry(l[0], l[1]), MAT.lineaSuelo);
    linea.rotation.x = -Math.PI / 2;
    linea.position.set(l[2], 0.01, l[3]);
    linea.receiveShadow = true;
    scene.add(linea);
  });

  // suelo fisico, un plano básico de cannon
  var ground = new CANNON.Body({ mass: 0, material: groundMaterial });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);
}

//rizo
function construirRizo(def) {
  var R = def.radio, e = 0.5, nFisica = 48;

  // visual
  var mesh = new THREE.Mesh(crearGeometriaRizo(R, def.ancho, e, def.desp, 160), MAT.rizo);
  mesh.position.set(def.x, 0.02, def.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  agregarBordes(mesh, 0xff8a1f);
  scene.add(mesh);
  objetosCamara.push(mesh);

  // reflexión propia
  var destino = new THREE.WebGLCubeRenderTarget(128, {
    type: esHDR ? THREE.HalfFloatType : THREE.UnsignedByteType
  });
  var camara = new THREE.CubeCamera(0.3, 80, destino);
  camara.position.set(def.x + def.desp / 2, R, def.z);
  sondaRizo = {
    camara: camara, destino: destino, mesh: mesh,
    pmrem: new THREE.PMREMGenerator(renderer),
    resultado: null,
    activa: false, cuenta: 0
  };


  // fisica con 48 prismas, cada uno un trozo de corona circular (siempre convexo)
  var cuerpo = new CANNON.Body({ mass: 0, material: groundMaterial });
  for (var k = 0; k < nFisica; k++) {
    var ta = 2 * Math.PI * k / nFisica;
    var tb = 2 * Math.PI * (k + 1) / nFisica;
    var poligono = [
      [R * Math.sin(ta), R - R * Math.cos(ta)],
      [(R + e) * Math.sin(ta), R - (R + e) * Math.cos(ta)],
      [(R + e) * Math.sin(tb), R - (R + e) * Math.cos(tb)],
      [R * Math.sin(tb), R - R * Math.cos(tb)]
    ];
    anadirPrisma(cuerpo, poligono, desplazamientoRizo((ta + tb) / 2, def.desp), def.ancho);
  }
  cuerpo.position.set(def.x, 0.02, def.z);
  world.addBody(cuerpo);
}
// chapa grecada de las paredes, parámetros al inicio
function crearGeometriaChapa(largo, alto) {
  var n = Math.max(1, Math.round(largo / PASO_GRECA));
  var paso = largo / n, prof = PROF_GRECA;
  var s = new THREE.Shape();
  s.moveTo(-largo / 2, 0);
  for (var i = 0; i < n; i++) {
    var x = -largo / 2 + i * paso;
    s.lineTo(x + 0.15 * paso, prof);
    s.lineTo(x + 0.50 * paso, prof);
    s.lineTo(x + 0.65 * paso, 0);
    s.lineTo(x + paso, 0);
  }
  s.lineTo(largo / 2, -0.05);
  s.lineTo(-largo / 2, -0.05);
  s.closePath();

  var geo = new THREE.ExtrudeGeometry(s, { depth: alto, bevelEnabled: false });//como vimos en seminario de tron
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// para el reflejo del loop
function capturarSondaRizo(conQuad) {
  var s = sondaRizo;
  //para que no se capture a sí mismo
  s.mesh.visible = false;
  quad.visible = conQuad;
  ruedas.forEach(function (r) { r.visible = conQuad; });
  //para no repetir sombras
  renderer.shadowMap.autoUpdate = false;
  s.camara.update(renderer, scene);
  renderer.shadowMap.autoUpdate = true;
  s.mesh.visible = true;
  quad.visible = true;
  ruedas.forEach(function (r) { r.visible = true; });

  // PMREM para cubemap nítido y borroso en función de rugosidad sin recalcular
  s.resultado = s.pmrem.fromCubemap(s.destino.texture, s.resultado);
  if (MAT.rizo.envMap !== s.resultado.texture) {
    MAT.rizo.envMap = s.resultado.texture;
    MAT.rizo.needsUpdate = true;
  }
}

function actualizarSondaRizo() {
  var s = sondaRizo;
  if (s === null || !texturasListas) return;

  var cerca = s.camara.position.distanceTo(quad.position) < DIST_SONDA;
  if (!cerca) {
    // al salir, la ultima foto sinel vehículo, para que no se quede un reflejo fantasma
    if (s.activa) { capturarSondaRizo(false); s.activa = false; }
    return;
  }
  s.activa = true;
  if (++s.cuenta % FRAMES_SONDA === 0) capturarSondaRizo(true);
}

function crearParedesNave() {
  var altoTotal = alto_nave + flecha_cercha + 1.5;   // la pared llega hasta el techo
  var texRayas = crearTexturaRayas();
  var paredes = [
    { largo: ancho_nave, x: 0, z: largo_nave / 2, rot: 0 },
    { largo: ancho_nave, x: 0, z: -largo_nave / 2, rot: Math.PI },
    { largo: largo_nave, x: ancho_nave / 2, z: 0, rot: Math.PI / 2 },
    { largo: largo_nave, x: -ancho_nave / 2, z: 0, rot: -Math.PI / 2 }
  ];

  paredes.forEach(function (p) {
    var pared = new THREE.Group();
    pared.position.set(p.x, 0, p.z);
    pared.rotation.y = p.rot;

    // chapa por encima del zocalo
    var chapa = new THREE.Mesh(desplazarUV(crearGeometriaChapa(p.largo, altoTotal - alto_zocalo)), MAT.chapa);
    chapa.position.y = alto_zocalo;
    pared.add(chapa);

    // zocalo de hormigon que sobresale 40 cm hacia dentro
    var zocalo = new THREE.Mesh(desplazarUV(uvsEnMetros(new THREE.BoxGeometry(p.largo, alto_zocalo, 0.4))), MAT.hormigon);
    zocalo.position.set(0, alto_zocalo / 2, -0.2);
    zocalo.receiveShadow = true;
    pared.add(zocalo);

    // banda de rayas de seguridad
    var tex = texRayas.clone();
    tex.needsUpdate = true;
    tex.repeat.set(p.largo / 3.2, 1);
    var banda = new THREE.Mesh(new THREE.PlaneGeometry(p.largo, 0.8),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    banda.position.set(0, 0.4, -0.405);
    banda.rotation.y = Math.PI;
    banda.receiveShadow = true;
    pared.add(banda);

    // tira LED encima del zocalo
    var led = new THREE.Mesh(new THREE.BoxGeometry(p.largo, 0.08, 0.08), MAT.led);
    led.position.set(0, alto_zocalo + 0.04, -0.42);
    pared.add(led);

    scene.add(pared);

    // fisica
    var d = 0.1;
    cuerpoCaja(p.largo / 2 + 1, altoTotal / 2, 0.5,
      p.x + d * Math.sin(p.rot), altoTotal / 2, p.z + d * Math.cos(p.rot), p.rot);
  });

  // techo fisico: si un quarter pipe te lanza muy alto, chocas
  cuerpoCaja(ancho_nave / 2, 0.5, largo_nave / 2, 0, alto_nave + 0.5, 0);
}

//pilares y otras estructuras
function alturaCercha(x) {
  return canto_cercha + (flecha_cercha - canto_cercha) * (1 - Math.abs(x) / (ancho_nave / 2));
}

// para las vigas
function crearGeometriaIPE(alto) {
  var b = 0.35, h = 0.45, tf = 0.04, tw = 0.025;
  var s = new THREE.Shape();
  s.moveTo(-b / 2, -h / 2);
  s.lineTo(b / 2, -h / 2);
  s.lineTo(b / 2, -h / 2 + tf);
  s.lineTo(tw / 2, -h / 2 + tf);
  s.lineTo(tw / 2, h / 2 - tf);
  s.lineTo(b / 2, h / 2 - tf);
  s.lineTo(b / 2, h / 2);
  s.lineTo(-b / 2, h / 2);
  s.lineTo(-b / 2, h / 2 - tf);
  s.lineTo(-tw / 2, h / 2 - tf);
  s.lineTo(-tw / 2, -h / 2 + tf);
  s.lineTo(-b / 2, -h / 2 + tf);
  s.closePath();
  var g = new THREE.ExtrudeGeometry(s, { depth: alto, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

// cercha, un solo mesh con agujeros triangulares
function crearGeometriaCercha() {
  var W = ancho_nave / 2, n = 12;
  var forma = new THREE.Shape();
  forma.moveTo(-W, 0);
  forma.lineTo(W, 0);
  forma.lineTo(W, canto_cercha);
  forma.lineTo(0, flecha_cercha);
  forma.lineTo(-W, canto_cercha);
  forma.closePath();
  function hueco(a, b, c) {
    var cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, k = 0.7;
    var p = new THREE.Path();
    p.moveTo(cx + (a[0] - cx) * k, cy + (a[1] - cy) * k);
    p.lineTo(cx + (b[0] - cx) * k, cy + (b[1] - cy) * k);
    p.lineTo(cx + (c[0] - cx) * k, cy + (c[1] - cy) * k);
    p.closePath();
    forma.holes.push(p);
  }
  for (var i = 0; i < n; i++) {
    var xa = -W + i * 2 * W / n, xb = xa + 2 * W / n;
    var A = [xa, 0], B = [xb, 0], C = [xb, alturaCercha(xb)], D = [xa, alturaCercha(xa)];
    if (i % 2 === 0) { hueco(A, B, C); hueco(A, C, D); }
    else { hueco(A, B, D); hueco(B, C, D); }
  }
  var g = new THREE.ExtrudeGeometry(forma, { depth: 0.25, bevelEnabled: false });
  g.translate(0, 0, -0.125);
  return g;
}

function crearEstructuraNave() {
  var geoIPE = crearGeometriaIPE(alto_nave);
  var geoCercha = crearGeometriaCercha();
  var xPilar = ancho_nave / 2 - 0.65;//vigas justo delante de zócalos

  for (var z = -largo_nave / 2 + 10; z <= largo_nave / 2 - 10; z += 10) {
    // dos pilares
    [-1, 1].forEach(function (lado) {
      var pilar = new THREE.Mesh(geoIPE, MAT.acero);
      pilar.position.set(lado * xPilar, 0, z);
      pilar.rotation.y = Math.PI / 2;
      scene.add(pilar);
      objetosCamara.push(pilar);
      cuerpoCaja(0.25, alto_nave / 2, 0.2, lado * xPilar, alto_nave / 2, z);
    });
    // la cercha que apoya en ellos
    var cercha = new THREE.Mesh(geoCercha, MAT.acero);
    cercha.position.set(0, alto_nave, z);
    scene.add(cercha);
  }

  for (var xc = -40; xc <= 40; xc += 10) {
    var correa = new THREE.Mesh(uvsEnMetros(new THREE.BoxGeometry(0.15, 0.25, largo_nave)), MAT.acero);
    correa.position.set(xc, alto_nave + alturaCercha(xc) + 0.15, 0);
    scene.add(correa);
  }

  // cubierta a dos aguas y claraboyas
  var W = ancho_nave / 2;
  var pendiente = Math.atan2(flecha_cercha - canto_cercha, W);
  var largoFaldon = Math.hypot(W, flecha_cercha - canto_cercha) + 0.5;
  var yFaldon = alto_nave + (canto_cercha + flecha_cercha) / 2 + 0.35;
  [-1, 1].forEach(function (lado) {
    var faldon = new THREE.Mesh(desplazarUV(uvsEnMetros(new THREE.BoxGeometry(largoFaldon, 0.2, largo_nave))), MAT.techo);
    faldon.position.set(lado * W / 2, yFaldon, 0);
    faldon.rotation.z = -lado * pendiente;
    scene.add(faldon);

    var claraboya = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, largo_nave - 20), MAT.claraboya);
    claraboya.position.set(lado * W / 2, yFaldon - 0.14, 0);
    claraboya.rotation.z = -lado * pendiente;
    scene.add(claraboya);
  });

  // tiras LED colgadas a lo largo de la nave
  [-32, -12, 12, 32].forEach(function (xl) {
    var lampara = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, largo_nave - 20), MAT.lampara);
    lampara.position.set(xl, alto_nave - 0.4, 0);
    scene.add(lampara);
  });
}

//rampas, formas de perfil extruidas
function perfilLineal(largo, alto) {
  return [[0, 0], [largo, alto]];
}

// rampa de dipo kicker
function perfilKicker(largo, alto) {
  var p = [];
  for (var i = 0; i <= 10; i++) {
    var t = i / 10;
    p.push([largo * t, alto * t * t]);
  }
  return p;
}

// rampa tipo tabletop
function perfilMesa(alto, subida, plano, bajada) {
  return [[0, 0], [subida, alto], [subida + plano, alto], [subida + plano + bajada, 0]];
}

// rampa de pared o Qpipe
function perfilQuarter(radio, gradosMax, deck) {
  var p = [];
  function punto(grados) {
    var a = THREE.MathUtils.degToRad(grados);
    p.push([radio * Math.sin(a), radio * (1 - Math.cos(a))]);
  }
  // transicion hasta la vertical
  var hastaVertical = Math.min(gradosMax, 90);
  for (var i = 0; i <= 12; i++) punto(hastaVertical * i / 12);
  // para que te lance hacia atrás y no hacia la pared
  var extra = Math.max(0, gradosMax - 90);
  var nExtra = Math.ceil(extra / 4);
  for (i = 1; i <= nExtra; i++) punto(90 + extra * i / nExtra);
  var labio = p[p.length - 1];
  var inicioDeck = gradosMax >= 90 ? radio : labio[0];
  p.push([inicioDeck + deck, labio[1]]);
  return p;
}

// desplazamiento lateral segun el angulo recorrido
function desplazamientoRizo(t, desp) {
  var s = THREE.MathUtils.clamp((t - Math.PI / 2) / Math.PI, 0, 1);
  return desp * s * s * (3 - 2 * s);
}

function crearGeometriaRizo(R, ancho, grosor, desp, n) {
  var posiciones = [], uvs = [], indices = [];

  function punto(i, radio, lado) {
    var t = 2 * Math.PI * i / n;
    return [
      desplazamientoRizo(t, desp) + lado * ancho / 2,
      R - radio * Math.cos(t),
      radio * Math.sin(t)
    ];
  }

  //cinta entre los bordes que definen el loop
  function cinta(radioA, ladoA, radioB, ladoB) {
    var base = posiciones.length / 3;
    var a0 = punto(0, radioA, ladoA), b0 = punto(0, radioB, ladoB);
    var anchoCinta = Math.hypot(a0[0] - b0[0], a0[1] - b0[1], a0[2] - b0[2]);
    var radioMedio = (radioA + radioB) / 2;
    for (var i = 0; i <= n; i++) {
      var v = 2 * Math.PI * i / n * radioMedio;
      posiciones.push.apply(posiciones, punto(i, radioA, ladoA));
      posiciones.push.apply(posiciones, punto(i, radioB, ladoB));
      uvs.push(0, v, anchoCinta, v);
    }
    for (i = 0; i < n; i++) {
      var a = base + 2 * i, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  cinta(R, -1, R, 1);//superficie interior
  cinta(R + grosor, 1, R + grosor, -1);//exterior
  //laterales
  cinta(R + grosor, -1, R, -1);
  cinta(R, 1, R + grosor, 1);

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// rampa tipo spine
function perfilSpine(radio, gradosMax) {
  var subida = perfilQuarter(radio, gradosMax, 0);
  subida.pop();                                  // sin deck
  var cima = subida[subida.length - 1];
  var p = subida.slice();
  for (var i = subida.length - 2; i >= 0; i--)
    p.push([2 * cima[0] - subida[i][0], subida[i][1]]);
  return p;
}

// los baches
function perfilBaches(cantidad, separacion, alto) {
  var p = [], n = cantidad * 8;
  for (var i = 0; i <= n; i++) {
    var z = i / n * cantidad * separacion;
    p.push([z, alto * (1 - Math.cos(2 * Math.PI * z / separacion)) / 2]);
  }
  return p;
}

//construyo cualquiuer rampa 
function construirRampa(def) {
  var pts = def.perfil.slice();
  var fin = pts[pts.length - 1];
  if (fin[1] > 0.001) pts.push([fin[0], 0]);
  var largo = pts[pts.length - 1][0];
  var rumbo = def.rumbo || 0;

  // ---------- VISUAL ----------
  var forma = new THREE.Shape();
  forma.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) forma.lineTo(pts[i][0], pts[i][1]);
  forma.closePath();

  var geo = new THREE.ExtrudeGeometry(forma, { depth: def.ancho, bevelEnabled: false });//generamos todas con extrusiones
  geo.rotateY(-Math.PI / 2);
  geo.translate(def.ancho / 2, 0, -largo / 2);

  var mesh = new THREE.Mesh(geo, MAT.rampa);
  mesh.position.set(def.x, 0, def.z);
  mesh.rotation.y = rumbo;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  agregarBordes(mesh, 0xff8a1f);
  scene.add(mesh);
  objetosCamara.push(mesh);

  //fisica
  var cuerpo = new CANNON.Body({ mass: 0, material: groundMaterial });
  var perfil = def.perfil;
  var zMax = -Infinity;// hasta donde ya hay rampa maciza, para evitar cortes
  var piel = 0.4;

  for (var j = 0; j < perfil.length - 1; j++) {
    var za = perfil[j][0] - largo / 2, ya = perfil[j][1];
    var zb = perfil[j + 1][0] - largo / 2, yb = perfil[j + 1][1];

    if (zb > za + 0.001) {
      var zs = Math.max(za, zMax);
      if (zb - zs > 0.001) {
        var ys = ya + (yb - ya) * (zs - za) / (zb - za);
        var poligono = [[zs, 0], [zb, 0]];
        if (yb > 0.005) poligono.push([zb, yb]);
        if (ys > 0.005) poligono.push([zs, ys]);
        if (poligono.length >= 3) anadirPrisma(cuerpo, poligono, 0, def.ancho);
      }
    } else if (za > zb + 0.001) {
      var L = Math.hypot(zb - za, yb - ya);
      var nz = -(yb - ya) / L, ny = (zb - za) / L;
      var techo = Math.max(ya, yb);//la placa no puede asomar por encima del borde, porque modificaría la trayectoria al final
      anadirPrisma(cuerpo, [
        [za, ya],
        [zb, yb],
        [zb - nz * piel, Math.min(yb - ny * piel, techo)],
        [za - nz * piel, Math.min(ya - ny * piel, techo)]
      ], 0, def.ancho);
    }
    zMax = Math.max(zMax, za, zb);
  }
  cuerpo.position.set(def.x, 0, def.z);
  cuerpo.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rumbo);
  world.addBody(cuerpo);
}

function crearContenedor(x, y, z, largo, material, rotY) {
  var ancho = 2.44, alto = 2.6;//medidas de los contenedores
  var c = new THREE.Mesh(uvsEnMetros(new THREE.BoxGeometry(ancho, alto, largo)), material);
  c.position.set(x, y + alto / 2, z);
  c.rotation.y = rotY || 0;
  c.castShadow = true;
  c.receiveShadow = true;
  scene.add(c);
  objetosCamara.push(c);
  cuerpoCaja(ancho / 2, alto / 2, largo / 2, x, y + alto / 2, z, rotY || 0);
}

function crearContenedores() {
  crearContenedor(-36.0, 0, 40.1, 12.2, MAT.contRojo);
  crearContenedor(-33.5, 0, 40.1, 12.2, MAT.contAzul);
  crearContenedor(-41.5, 0, 55, 6.1, MAT.contAzul);
  crearContenedor(-41.5, 2.6, 55, 6.1, MAT.contRojo);
  crearContenedor(37.5, 0, -60, 12.2, MAT.contGris, Math.PI / 2);
  crearContenedor(37.5, 0, -57.4, 12.2, MAT.contRojo, Math.PI / 2);
  crearContenedor(37.5, 2.6, -58.7, 12.2, MAT.contAzul, Math.PI / 2);
}
// ---------------------------------------------------------------------------
// El quad/vehículo
// ------------------------------------------------------------------------------


function opcionesRueda(radio) {
  return {
    radius: radio,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionRestLength: SUSPENSION_REPOSO,
    suspensionStiffness: RIGIDEZ_SUSPENSION,
    maxSuspensionTravel: 0.35,
    dampingRelaxation: 2.5,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    frictionSlip: 2.4,
    rollInfluence: 0.05,
    axleLocal: new CANNON.Vec3(1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(),
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };
}

//fisica, 4 anclajes para las ruedas, las primeras son las de dirección
function crearFisicaQuad(anclajes, radio, medioAncho, medioLargo) {
  chassisBody = new CANNON.Body({ mass: 200, material: quadMaterial });
  //chasis
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(medioAncho, 0.25, medioLargo)), new CANNON.Vec3(0, 0.2, 0));
  //una esfera por rueda
  for (var k = 0; k < 4; k++) {
    chassisBody.addShape(new CANNON.Sphere(0.3),
      new CANNON.Vec3(anclajes[k][0], anclajes[k][1], anclajes[k][2]));
  }
  chassisBody.angularDamping = 0.05;
  chassisBody.position.copy(pos_inicial);

  vehicle = new CANNON.RaycastVehicle({
    chassisBody: chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2
  });
  for (var i = 0; i < 4; i++) {
    var op = opcionesRueda(radio);
    op.chassisConnectionPointLocal.set(anclajes[i][0], anclajes[i][1], anclajes[i][2]);
    vehicle.addWheel(op);
  }
  vehicle.addToWorld(world);

  //para dejar marca en el suelo
  chassisBody.addEventListener('collide', function (e) {
    if (Math.abs(e.contact.getImpactVelocityAlongNormal()) > 5) impactoFuerte = 0.35;
  });
}

// carga asincrona como en s5 de texturas o tron
function crearQuad() {
  new THREE.GLTFLoader(gestorCarga).load(RUTA_MODELO, montarModeloQuad, undefined, function (error) {
    console.warn('No se pudo cargar el modelo del quad: se usa el quad basico', error);
    crearQuadBasico();
  });
}

//para determinar lo que mide el vehículo en función del modelo, necesario para cambiar de modelo si uno quisiera
function calcularMedidasQuad(cajas) {
  function centro(c) { return { x: (c.min.x + c.max.x) / 2, y: (c.min.y + c.max.y) / 2, z: (c.min.z + c.max.z) / 2 }; }
  function volumen(c) { return (c.max.x - c.min.x) * (c.max.y - c.min.y) * (c.max.z - c.min.z); }

  // las 4 piezas mas pequenas son las ruedas; todo lo demas es el chasis
  var orden = cajas.map(function (c, i) { return i; })
    .sort(function (a, b) { return volumen(cajas[a]) - volumen(cajas[b]); });
  var idxRuedas = orden.slice(0, 4), idxChasis = orden.slice(4);

  // centro del vehiculo = media de los centros de las 4 ruedas
  var centros = idxRuedas.map(function (i) { return centro(cajas[i]); });
  var C = { x: 0, y: 0, z: 0 };
  centros.forEach(function (c) { C.x += c.x / 4; C.y += c.y / 4; C.z += c.z / 4; });

  // escala: que el modelo entero mida LARGO_QUAD de punta a punta
  var minZ = Infinity, maxZ = -Infinity;
  cajas.forEach(function (c) { minZ = Math.min(minZ, c.min.z); maxZ = Math.max(maxZ, c.max.z); });
  var s = LARGO_QUAD / (maxZ - minZ);
  var porZ = [0, 1, 2, 3].sort(function (a, b) { return centros[b].z - centros[a].z; });
  function porX(a, b) { return centros[b].x - centros[a].x; }
  var ruedasOrden = porZ.slice(0, 2).sort(porX).concat(porZ.slice(2).sort(porX));

  var anclajes = ruedasOrden.map(function (k) {
    var c = centros[k];
    return [(c.x - C.x) * s, ALTO_ANCLAJE + (c.y - C.y) * s, (c.z - C.z) * s];
  });

  var r0 = cajas[idxRuedas[ruedasOrden[0]]];
  var radio = Math.max(r0.max.y - r0.min.y, r0.max.z - r0.min.z) / 2 * s;
  var anchoRueda = (r0.max.x - r0.min.x) * s;

  var cx = { min: Infinity, max: -Infinity }, cz = { min: Infinity, max: -Infinity };
  idxChasis.forEach(function (i) {
    cx.min = Math.min(cx.min, cajas[i].min.x); cx.max = Math.max(cx.max, cajas[i].max.x);
    cz.min = Math.min(cz.min, cajas[i].min.z); cz.max = Math.max(cz.max, cajas[i].max.z);
  });
  var ruedaInterior = Math.min.apply(null, anclajes.map(function (a) { return Math.abs(a[0]); })) - anchoRueda / 2;
  var medioAncho = Math.min((cx.max - cx.min) / 2 * s, ruedaInterior - 0.02);
  var medioLargo = (cz.max - cz.min) / 2 * s * 0.9;

  return {
    idxRuedas: ruedasOrden.map(function (k) { return idxRuedas[k]; }),
    centrosRuedas: ruedasOrden.map(function (k) { return centros[k]; }),
    idxChasis: idxChasis,
    centro: C, escala: s, anclajes: anclajes,
    radio: radio, anchoRueda: anchoRueda, medioAncho: medioAncho, medioLargo: medioLargo
  };
}

function montarModeloQuad(gltf) {
  var raiz = gltf.scene;
  raiz.updateMatrixWorld(true);

  // para trabajar con las piezas sueltas, necesario para simular bien las físicas
  var piezas = [];
  raiz.traverse(function (o) {
    if (!o.isMesh) return;
    var geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (MODELO_AL_REVES) geo.rotateY(Math.PI);//depende del modelo
    geo.computeBoundingBox();
    piezas.push({ geo: geo, material: o.material, caja: geo.boundingBox });
  });
  if (piezas.length < 5) {
    console.warn('El modelo no tiene chasis + 4 ruedas separadas: se usa el quad basico');
    crearQuadBasico();
    return;
  }

  // determinamos piezas
  var m = calcularMedidasQuad(piezas.map(function (p) { return p.caja; }));
  console.log('Quad: escala ' + m.escala.toFixed(3) + ', radio rueda ' + m.radio.toFixed(2) +
    ' m, anclajes ' + JSON.stringify(m.anclajes.map(function (a) { return a.map(function (v) { return +v.toFixed(2); }); })));

  // fisica
  crearFisicaQuad(m.anclajes, m.radio, m.medioAncho, m.medioLargo);

  quad = new THREE.Group();
  m.idxChasis.forEach(function (i) {
    var geo = piezas[i].geo;
    geo.translate(-m.centro.x, -m.centro.y, -m.centro.z);
    geo.scale(m.escala, m.escala, m.escala);
    geo.translate(0, ALTO_ANCLAJE - SUSPENSION_CARGADA, 0);
    quad.add(new THREE.Mesh(geo, piezas[i].material));
  });
  scene.add(quad);

  //ruedas
  m.idxRuedas.forEach(function (i, n) {
    var c = m.centrosRuedas[n], geo = piezas[i].geo;
    geo.translate(-c.x, -c.y, -c.z);
    geo.scale(m.escala, m.escala, m.escala);
    var rueda = new THREE.Mesh(geo, piezas[i].material);
    scene.add(rueda);
    ruedas.push(rueda);
  });

  prepararMallasQuad();
}

// sombras y reflejos para todas las piezas del quad
function prepararMallasQuad() {
  quad.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  ruedas.forEach(function (r) { r.castShadow = true; });
  var mallas = [];
  quad.traverse(function (o) { if (o.isMesh) mallas.push(o); });
  mallas.concat(ruedas).forEach(function (o) {
    var mat = o.material;
    if (mat && mat.isMeshStandardMaterial && materialesPBR.indexOf(mat) < 0) {
      mat.envMapIntensity = ajustesLuz.reflejos;//reflejan como el resto de metales, aunque no se nota mucho con el modelo por defecto porque es de colores
      materialesPBR.push(mat);
    }
  });
}

// Quad de cajas, por defecto si no hay modelo
function crearQuadBasico() {
  crearFisicaQuad([[0.6, ALTO_ANCLAJE, 0.7], [-0.6, ALTO_ANCLAJE, 0.7],
  [0.6, ALTO_ANCLAJE, -0.7], [-0.6, ALTO_ANCLAJE, -0.7]], 0.35, 0.5, 0.9);

  quad = new THREE.Group();
  var matCarroceria = new THREE.MeshPhongMaterial({ color: colorSRGB(0xff66ff), shininess: 60 });
  var matNegro = new THREE.MeshPhongMaterial({ color: colorSRGB(0x222222) });
  var chasis = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.8), matCarroceria);
  chasis.position.y = 0.15;
  quad.add(chasis);
  var asiento = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.7), matNegro);
  asiento.position.set(0, 0.37, -0.3);
  quad.add(asiento);
  var manillar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), matNegro);
  manillar.rotation.z = Math.PI / 2;
  manillar.position.set(0, 0.6, 0.45);
  quad.add(manillar);
  scene.add(quad);

  var geoRueda = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 20);
  geoRueda.rotateZ(Math.PI / 2);
  for (var j = 0; j < 4; j++) {
    var rueda = new THREE.Mesh(geoRueda, matNegro);
    rueda.add(new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.08, 0.6), matCarroceria));
    scene.add(rueda);
    ruedas.push(rueda);
  }
  prepararMallasQuad();
}

function actualizarEstadoQuad(delta) {
  // cuantas ruedas tocan algo
  ruedasEnSuelo = 0;
  for (var i = 0; i < 4; i++)
    if (vehicle.wheelInfos[i].isInContact) ruedasEnSuelo++;

  chasisEnContacto = false;
  for (var c = 0; c < world.contacts.length; c++) {
    var ct = world.contacts[c];
    if (ct.bi === chassisBody || ct.bj === chassisBody) { chasisEnContacto = true; break; }
  }

  enElAire = ruedasEnSuelo === 0 && !chasisEnContacto;

  //para cuando me quedo trabado, volcado, etc, enderezo
  var arriba = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
  var atascado = !enElAire && ruedasEnSuelo < 3 && arriba.y < 0.85 && chassisBody.velocity.length() < 2;
  if (atascado) tiempoVolcado += delta;
  else tiempoVolcado = 0;
  if (tiempoVolcado > 1.5) enderezarQuad();   // tras 1.5 s atascado se levanta solo
}

// con la R levanto el vehículo yo
function enderezarQuad() {
  var morro = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  var rumboQuad = Math.atan2(morro.x, morro.z);
  chassisBody.position.y += 1;
  chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rumboQuad);
  chassisBody.velocity.set(0, 0, 0);
  chassisBody.angularVelocity.set(0, 0, 0);
  saltando = false;
  tiempoVolcado = 0;
}

// reinicio a posición de salida
function reiniciarQuad() {
  chassisBody.position.copy(pos_inicial);
  chassisBody.quaternion.set(0, 0, 0, 1);
  chassisBody.velocity.set(0, 0, 0);
  chassisBody.angularVelocity.set(0, 0, 0);
  direccion = 0;
  saltando = false;
  tiempoVolcado = 0;
  estelaRueda.forEach(function (e) { e.activa = false; });
}


function actualizarTrucos(delta) {
  //para calculo de trucos
  var aterrizado = ruedasEnSuelo >= 3 || chasisEnContacto;

  if (!saltando && enElAire) {
    saltando = true;
    tiempoEnAire = 0;
    velCaida = 0;
    giroAcum.set(0, 0, 0);
  }
  if (!saltando) return;

  tiempoEnAire += delta;
  velCaida = Math.min(velCaida, chassisBody.velocity.y);
  var w = chassisBody.quaternion.conjugate().vmult(chassisBody.angularVelocity);
  giroAcum.x += w.x * delta;
  giroAcum.y += w.y * delta;
  giroAcum.z += w.z * delta;

  if (aterrizado) {
    saltando = false;
    if (velCaida < -9) impactoFuerte = 0.3;//para marcar neumáticos en aterrizaje fuerte
    evaluarSalto();
  }
}

function prefijo(n) {
  return n === 1 ? '' : n === 2 ? 'DOUBLE ' : n === 3 ? 'TRIPLE ' : n + 'x ';
}

function evaluarSalto() {
  if (estado !== 'jugando' || tiempoEnAire < 0.4) return;//solo saltos de más de 0.4 sec

  var lista = [];
  var pts = 0;

  var flips = Math.floor((Math.abs(giroAcum.x) + margenVuelta) / (2 * Math.PI));
  if (flips > 0) {
    lista.push(prefijo(flips) + (giroAcum.x < 0 ? 'BACKFLIP' : 'FRONTFLIP'));
    pts += 1000 * flips;
  }
  var sides = Math.floor((Math.abs(giroAcum.z) + margenVuelta) / (2 * Math.PI));
  if (sides > 0) {
    lista.push(prefijo(sides) + 'SIDEFLIP');
    pts += 1200 * sides;
  }
  var medios = Math.floor((Math.abs(giroAcum.y) + margenVuelta / 2) / Math.PI);
  if (medios >= 2) {
    lista.push((medios * 180) + ' SPIN');
    pts += 300 * medios;
  }

  // volar también como truco
  if (lista.length === 0 && tiempoEnAire > 1) {
    lista.push('AIR ' + tiempoEnAire.toFixed(1) + 's');
    pts += 200;
  }

  if (lista.length === 0) return;
  //calculo puntuaciones
  pts += Math.round(tiempoEnAire * 100);
  pts *= lista.length;
  puntos += pts;
  mostrarTruco(lista.join(' + '), '+' + pts.toLocaleString('es-ES'), false);
}

function controlarQuad(delta) {//con funciones de cannon para aplicarr fuerzas, etc
  var adelante = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  var v = chassisBody.velocity.dot(adelante);

  // motor
  var fuerza = 0, freno = 0;
  if (controls.acelerar && v < velocidadMax) fuerza = -fuerzaMotor;
  if (controls.frenar) {
    if (v > 1) freno = fuerzaFreno;
    else fuerza = fuerzaMotor * 0.5;
  }
  if (controls.freno || estado !== 'jugando') freno = fuerzaFreno;
  for (var i = 0; i < 4; i++) {
    vehicle.applyEngineForce(fuerza, i);
    vehicle.setBrake(freno, i);
  }

  var objetivo = 0;
  if (controls.izquierda) objetivo += giroMax;
  if (controls.derecha) objetivo -= giroMax;
  direccion += (objetivo - direccion) * Math.min(1, delta * 8);
  vehicle.setSteeringValue(direccion, 0);
  vehicle.setSteeringValue(direccion, 1);

  if (enElAire && tiempoEnAire > 0.1) controlAereo(delta);
}

function controlAereo(delta) {//con las flechas
  var w = chassisBody.quaternion.conjugate().vmult(chassisBody.angularVelocity);
  var k = Math.min(1, delta * respuestaAire);
  var f = Math.min(1, delta * frenoGiroAire);

  // x local
  if (controls.flipAdelante) w.x += (velGiroAire - w.x) * k;
  else if (controls.flipAtras) w.x += (-velGiroAire - w.x) * k;
  else w.x -= w.x * f;

  // z local
  if (controls.sideDer) w.z += (velGiroAire - w.z) * k;
  else if (controls.sideIzq) w.z += (-velGiroAire - w.z) * k;
  else w.z -= w.z * f;

  // y local
  if (controls.spinIzq) w.y += (velGiroAire * 0.8 - w.y) * k;
  else if (controls.spinDer) w.y += (-velGiroAire * 0.8 - w.y) * k;
  else w.y -= w.y * f;

  chassisBody.quaternion.vmult(w, chassisBody.angularVelocity);
}

// ---------------------------------------------------------------------------
// Camara, tipo spring como la del tron definitivo
// -----------------------------------------------------------------------------
function updateCamera(delta) {
  var pos = new THREE.Vector3().copy(chassisBody.position);
  var aC = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
  var mC = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  var arriba = new THREE.Vector3(aC.x, aC.y, aC.z);
  var morro = new THREE.Vector3(mC.x, mC.y, mC.z);

  // rumbo
  var velH = new THREE.Vector3(chassisBody.velocity.x, 0, chassisBody.velocity.z);
  var dir = null;
  if (saltando) {
    // en el aire solo trayectoria, para que la camara no maree con los trucos
    if (velH.length() > 2) dir = velH.clone().normalize();
  } else if (arriba.y > 0.5) {
    // en el suelo y derecho: la velocidad si avanzamos, el morro si vamos marcha atras
    var morroH = new THREE.Vector3(morro.x, 0, morro.z);
    if (velH.length() > 3 && velH.dot(morroH) > 0) dir = velH.clone().normalize();
    else if (morroH.lengthSq() > 0.01) dir = morroH.normalize();
  }

  if (dir) rumbo.lerp(dir, Math.min(1, delta * 3)).normalize();

  // para Qpipe o loop
  var enPared = !saltando && ruedasEnSuelo >= 2 && arriba.y < 0.5;
  factorPared += ((enPared ? 1 : 0) - factorPared) * Math.min(1, delta * 4);

  // posición mezclando los dos modos
  var deseadaNormal = pos.clone().addScaledVector(rumbo, -distancia_camara);
  deseadaNormal.y = pos.y + altura_camara;
  var mirarNormal = pos.clone().addScaledVector(rumbo, 2);
  mirarNormal.y += 1;

  var deseadaPared = pos.clone()
    .addScaledVector(arriba, alturaPared)
    .addScaledVector(morro, -distanciaPared);
  var mirarPared = pos.clone().addScaledVector(arriba, 0.8);

  var deseada = deseadaNormal.lerp(deseadaPared, factorPared);
  var mirar = mirarNormal.lerp(mirarPared, factorPared);

  // limites de la nave
  var margen = 2;
  deseada.x = THREE.MathUtils.clamp(deseada.x, -ancho_nave / 2 + margen, ancho_nave / 2 - margen);
  deseada.z = THREE.MathUtils.clamp(deseada.z, -largo_nave / 2 + margen, largo_nave / 2 - margen);
  deseada.y = THREE.MathUtils.clamp(deseada.y, 0.5, alto_nave - 1);

  // para que la cámara no se tape con objetos
  var foco = pos.clone().addScaledVector(arriba, 0.6);
  limitarPorOclusion(foco, deseada);

  // tipo muelle
  var aceleracion = deseada.clone().sub(camera.position).multiplyScalar(rigidez)
    .addScaledVector(velCamara, -amortiguamiento);
  velCamara.addScaledVector(aceleracion, delta);
  camera.position.addScaledVector(velCamara, delta);

  // para que la incercia del muelle tampoco se cruce con nada
  limitarPorOclusion(foco, camera.position);

  objetivoCamara.lerp(mirar, Math.min(1, delta * 10));
  camera.lookAt(objetivoCamara);
}

// para cuando tiene algo delante la cámara, como ocurre en el loop, la acerco
function limitarPorOclusion(desde, punto) {
  var dir = punto.clone().sub(desde);
  var dist = dir.length();
  if (dist < 0.01) return;
  dir.divideScalar(dist);

  raycasterCamara.set(desde, dir);
  raycasterCamara.far = dist;
  var impactos = raycasterCamara.intersectObjects(objetosCamara, false);
  if (impactos.length === 0) return;

  var d = Math.max(0.5, impactos[0].distance - 0.3);   // 30 cm de margen
  punto.copy(desde).addScaledVector(dir, d);
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
function mostrarTruco(nombre, detalle) {
  var caja = document.getElementById('hud-truco');
  document.getElementById('hud-truco-nombre').textContent = nombre;
  document.getElementById('hud-truco-pts').textContent = detalle;
  caja.classList.add('visible');
  document.getElementById('hud-puntos').textContent = puntos.toLocaleString('es-ES');
  clearTimeout(temporizadorTruco);
  temporizadorTruco = setTimeout(function () { caja.classList.remove('visible'); }, 2000);
}

function update() {
  if (quad === null) return;
  var delta = Math.min(clock.getDelta(), 0.05);

  controlarQuad(delta);
  world.step(1 / 120, delta, 8);
  actualizarEstadoQuad(delta);
  actualizarTrucos(delta);
  actualizarMarcas(delta);
  // Sincronizar el mesh visual con su cuerpo fisico (s4-fisica-1.js). Solo el quad
  // tiene cuerpo dinamico: copiarlo directamente evita recorrer toda la escena cada frame.
  quad.position.copy(chassisBody.position);
  quad.quaternion.copy(chassisBody.quaternion);

  // posición y giro de ruedas calculadas por vehículo
  for (var i = 0; i < 4; i++) {
    vehicle.updateWheelTransform(i);
    var t = vehicle.wheelInfos[i].worldTransform;
    ruedas[i].position.copy(t.position);
    ruedas[i].quaternion.copy(t.quaternion);
  }

  actualizarFoco();

  actualizarSondaRizo();
  if (estado === 'jugando') {
    actualizarCronometro(delta);
    updateCamera(delta);
  } else {
    camaraMenu(delta);
  }
  stats.update();
}

function render() {
  requestAnimationFrame(render);
  update();
  composer.render();
}

// ======================================================================
// MARCAS DE NEUMATICO: como geometría dinámica en tron
// ======================================================================
function crearMarcas() {
  var indices = [];
  for (var s = 0; s < MAX_MARCAS; s++) {
    var v = s * 4;
    indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  }
  geoMarcas.setIndex(indices);
  geoMarcas.setAttribute('position', new THREE.BufferAttribute(posMarcas, 3).setUsage(THREE.DynamicDrawUsage));
  geoMarcas.setAttribute('color', new THREE.BufferAttribute(colMarcas, 4).setUsage(THREE.DynamicDrawUsage));
  geoMarcas.setDrawRange(0, 0);

  var marcas = new THREE.Mesh(geoMarcas, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,//para que se haga sobre el suelo
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide
  }));
  marcas.frustumCulled = false;
  marcas.renderOrder = 1;
  scene.add(marcas);

  for (var r = 0; r < 4; r++)
    estelaRueda.push({ activa: false, izq: new THREE.Vector3(), der: new THREE.Vector3() });
}

function pintarTramo(s, alfa) {
  for (var k = 0; k < 4; k++) {
    var c = (s * 4 + k) * 4;
    colMarcas[c] = colMarcas[c + 1] = colMarcas[c + 2] = 0.02;
    colMarcas[c + 3] = alfa;
  }
}

function agregarTramoMarca(a1, b1, a2, b2) {
  var s = siguienteMarca, v = s * 4;
  [a1, b1, a2, b2].forEach(function (p, k) {
    posMarcas[(v + k) * 3] = p.x;
    posMarcas[(v + k) * 3 + 1] = p.y;
    posMarcas[(v + k) * 3 + 2] = p.z;
  });
  nacimientoMarca[s] = tiempoJuego;
  pintarTramo(s, 0.75);
  siguienteMarca = (siguienteMarca + 1) % MAX_MARCAS;//buffer circular
  marcasUsadas = Math.min(marcasUsadas + 1, MAX_MARCAS);
  geoMarcas.attributes.position.needsUpdate = true;
  geoMarcas.attributes.color.needsUpdate = true;
  geoMarcas.setDrawRange(0, marcasUsadas * 6);
}

// recalculo alfa
function desvanecerMarcas(delta) {
  acumuladorFade += delta;
  if (acumuladorFade < 0.1) return;
  acumuladorFade = 0;
  for (var s = 0; s < marcasUsadas; s++) {
    var vida = 1 - (tiempoJuego - nacimientoMarca[s]) / VIDA_MARCA;
    pintarTramo(s, Math.max(0, vida) * 0.75);
  }
  geoMarcas.attributes.color.needsUpdate = true;
}

function actualizarMarcas(delta) {
  tiempoJuego += delta;
  if (impactoFuerte > 0) impactoFuerte -= delta;
  var vel = chassisBody.velocity;
  var rapidez = vel.norm();

  for (var i = 0; i < 4; i++) {
    var w = vehicle.wheelInfos[i];
    var e = estelaRueda[i];
    var derrapa = w.sliding || w.skidInfo < 0.6;
    var frenando = controls.freno && rapidez > 3;
    var marcar = w.raycastResult.hasHit && rapidez > 1.5 &&
      (derrapa || frenando || impactoFuerte > 0);
    if (!marcar) { e.activa = false; continue; }

    // punto exacto donde toca la rueda para rampas 
    var p = w.raycastResult.hitPointWorld, nC = w.raycastResult.hitNormalWorld;
    var normal = new THREE.Vector3(nC.x, nC.y, nC.z);
    var punto = new THREE.Vector3(p.x, p.y, p.z).addScaledVector(normal, 0.02);

    var lateral = new THREE.Vector3(vel.x, vel.y, vel.z).cross(normal);
    if (lateral.lengthSq() < 1e-4) { e.activa = false; continue; }
    lateral.normalize().multiplyScalar(ANCHO_MARCA / 2);
    var izq = punto.clone().add(lateral);
    var der = punto.clone().sub(lateral);

    if (e.activa) {
      var d = izq.distanceTo(e.izq);
      if (d < 0.15) continue;
      if (d < 2) agregarTramoMarca(e.izq, e.der, izq, der);
    }
    //los tramos empiezan donde acaban los anteriores
    e.izq.copy(izq);
    e.der.copy(der);
    e.activa = true;
  }
  desvanecerMarcas(delta);
}

// ======================================================================
// SESION: MENU, CRONOMETRO Y CATEGORIAS
// ======================================================================
function textoEmpezar(html) {
  document.getElementById('empezar').innerHTML = html;
}

function soltarControles() {
  for (var k in controls) controls[k] = false;
}

function empezarSesion() {
  estado = 'jugando';
  puntos = 0;
  tiempoRestante = DURACION_SESION;
  soltarControles();
  reiniciarQuad();

  //camara al vehículo
  rumbo.set(0, 0, 1);
  velCamara.set(0, 0, 0);
  factorPared = 0;
  camera.position.set(pos_inicial.x, pos_inicial.y + altura_camara, pos_inicial.z - distancia_camara);
  objetivoCamara.set(pos_inicial.x, pos_inicial.y + 1, pos_inicial.z + 2);

  document.getElementById('hud-puntos').textContent = '0';
  document.getElementById('hud-truco').classList.remove('visible');
  document.getElementById('menu').classList.add('oculto');
  document.getElementById('hud').classList.remove('oculto');
  actualizarCronometro(0);
}

function terminarSesion() {
  estado = 'menu';
  soltarControles();

  var cat = CATEGORIAS.find(function (c) { return puntos >= c.min; });
  var record = leerRecord();
  var nuevoRecord = puntos > record;
  if (nuevoRecord) guardarRecord(puntos);

  document.getElementById('resultado').classList.remove('oculto');
  document.getElementById('res-puntos').textContent = puntos.toLocaleString('es-ES');
  var elCat = document.getElementById('res-categoria');
  elCat.textContent = cat.nombre;
  elCat.style.color = cat.color;
  document.getElementById('res-medalla').textContent = 'Medalla: ' + cat.medalla;
  document.getElementById('res-record').textContent = nuevoRecord
    ? '¡NUEVO RÉCORD!'
    : 'Récord: ' + record.toLocaleString('es-ES');

  document.getElementById('menu').classList.remove('oculto');
  document.getElementById('hud').classList.add('oculto');
}

function actualizarCronometro(delta) {
  tiempoRestante -= delta;
  if (tiempoRestante <= 0) {
    tiempoRestante = 0;
    terminarSesion();
  }
  var s = Math.ceil(tiempoRestante);
  var el = document.getElementById('hud-tiempo');
  el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  el.classList.toggle('urgente', tiempoRestante <= 10);
}

//cámara del menú
function camaraMenu(delta) {
  anguloMenu += delta * 0.08;
  camera.position.set(Math.sin(anguloMenu) * 30, 12, Math.cos(anguloMenu) * 50);
  camera.lookAt(0, 3, 0);
}

//para guardar record si lo permite, es opcional y no para el juego
function leerRecord() {
  try { return Number(localStorage.getItem('quadRecord')) || 0; } catch (e) { return 0; }
}
function guardarRecord(valor) {
  try { localStorage.setItem('quadRecord', valor); } catch (e) { }
}
