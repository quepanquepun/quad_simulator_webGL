/*
 * Seminario practico: Tron Battle Grid
 *
 * Punto de partida copiado de js/base-sample.js (usado por ej-base.html).
 * Se han dejado tambien disponibles GLTFLoader y FBXLoader siguiendo
 * js/ej-loader.js y js/ej-loader-FBX.js, pero aqui no se carga ningun modelo:
 * esa parte se construira durante el seminario.
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

// escenario como en el ejemplo del tron
const largo_arena = 100;
const alto_pared = 20;

// para crear el quad
var quad = null;
var chassisBody = null;
var vehicle = null;
var ruedas = [];
const pos_inicial = new CANNON.Vec3(0, 1, -30);

// controles como en el tron, con alante y atrás también
const controls = {
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  brake: false
};
const fuerzaMotor = 400;  // N/m por rueda??
const velocidadMax = 18;    // m/s 
const fuerzaFreno = 5;
const giroMax = 0.65;   // radianes que giran las ruedas delanteras
var direccion = 0;     // giro actual (suavizado)

// spring camera, se calcula de forma separada
var velCamara = new THREE.Vector3();       // velocidad de la camara
var rumbo = new THREE.Vector3(0, 0, 1);     // hacia donde mira la camara (horizontal)
var objetivoCamara = new THREE.Vector3();     // punto al que mira (suavizado)
const distancia_camara = 7;
const altura_camara = 2.8;
const rigidez = 60;                           // k del muelle
const amortiguamiento = 2 * Math.sqrt(rigidez); // para que lleguue sin rigidez

document.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowUp' || event.code === 'KeyW') controls.moveForward = true;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') controls.moveBackward = true;
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') controls.moveLeft = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') controls.moveRight = true;
  if (event.code === 'Space') controls.brake = true;
  if (event.code === 'KeyR') reiniciarQuad();
});
document.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowUp' || event.code === 'KeyW') controls.moveForward = false;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') controls.moveBackward = false;
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') controls.moveLeft = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') controls.moveRight = false;
  if (event.code === 'Space') controls.brake = false;
});

init();
loadScene();
render();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x000000));
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  //iluminación del tron  
  var luzAmbiente = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(luzAmbiente);
  var luzDireccional = new THREE.DirectionalLight(0xffffff, 0.8);
  luzDireccional.position.set(30, 50, 20);
  scene.add(luzDireccional);

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

  window.addEventListener('resize', updateAspectRatio);
}

function loadScene() {
  // suelo del tron + cannon físico
  var geometriaSuelo = new THREE.PlaneGeometry(largo_arena + 50, largo_arena + 50);
  var materialSuelo = new THREE.MeshBasicMaterial({ color: 0x101820, side: THREE.DoubleSide });
  var suelo = new THREE.Mesh(geometriaSuelo, materialSuelo);
  suelo.rotation.x = -Math.PI / 2;
  scene.add(suelo);
  // añado rejilla para que se note la velocidad
  var rejilla = new THREE.GridHelper(largo_arena + 50, 30, 0x00ffff, 0x005566);
  rejilla.position.y = 0.01;//la subo un poco para que se vea
  scene.add(rejilla);

  // suelo físico
  const ground = new CANNON.Body({ mass: 0, material: groundMaterial });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);

  // pared del tron, como en el pdf
  var geometriaPared = new THREE.CylinderGeometry(largo_arena / 2, largo_arena / 2 - 10, alto_pared, 64, 1, true);
  var materialPared = new THREE.MeshBasicMaterial({ color: 0x003344, side: THREE.DoubleSide });
  var pared = new THREE.Mesh(geometriaPared, materialPared);
  pared.position.y = alto_pared / 2;
  scene.add(pared);

  //no hay cilindro hueco en cannon?? simulo con muros separados
  var radioPared = largo_arena / 2 - 10;
  var cantidad = 36, paso = 2 * Math.PI / cantidad;
  var ancho = 2 * radioPared * Math.tan(paso / 2) + 0.5;
  for (var i = 0; i < cantidad; i++) {
    var a = i * paso;
    var muro = new CANNON.Body({ mass: 0, material: groundMaterial });
    muro.addShape(new CANNON.Box(new CANNON.Vec3(ancho / 2, alto_pared / 2, 0.5)));
    muro.position.set(Math.cos(a) * (radioPared + 0.5), alto_pared / 2, Math.sin(a) * (radioPared + 0.5));
    muro.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2 - a);
    world.addBody(muro);
  }

  // focos como en el ejemplo
  var geometriaFoco = new THREE.BoxGeometry(1.6, 0.5, 0.8);
  var materialFoco = new THREE.MeshBasicMaterial({ color: 0xccffff });
  var radioFocos = 48;
  var alturaFocos = 18;
  for (var grados = 0; grados < 360; grados += 15) {
    var ang = THREE.MathUtils.degToRad(grados);
    var foco = new THREE.Mesh(geometriaFoco, materialFoco);
    foco.position.set(Math.cos(ang) * radioFocos, alturaFocos, Math.sin(ang) * radioFocos);
    foco.lookAt(0, alturaFocos, 0);
    scene.add(foco);
  }

  crearRampa();
  crearQuad();
}

// la rampa como caja inclinada, física = mundo real
function crearRampa() {
  var largo = 10, ancho = 6, grosor = 1, angulo = THREE.MathUtils.degToRad(20);//para cambiar inclinación

  var rampa = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, grosor, largo),
    new THREE.MeshPhongMaterial({ color: 0x0077aa })
  );
  rampa.rotation.x = -angulo;
  // la bajamos para que el borde de entrada quede a ras de suelo
  rampa.position.set(0, largo / 2 * Math.sin(angulo) - grosor / 2 * Math.cos(angulo) + 0.05, -10);
  scene.add(rampa);
  // bordes luminosos como en el ejemplo de tron avanzado
  rampa.add(new THREE.LineSegments(new THREE.EdgesGeometry(rampa.geometry),
    new THREE.LineBasicMaterial({ color: 0x00ffff })));

  var body = new CANNON.Body({ mass: 0, material: groundMaterial });
  body.addShape(new CANNON.Box(new CANNON.Vec3(ancho / 2, grosor / 2, largo / 2)));
  body.position.copy(rampa.position);
  body.quaternion.copy(rampa.quaternion);
  world.addBody(body);
  rampa.body = body;
}

// ---------------------------------------------------------------------------
// El quad
// ------------------------------------------------------------------------------
function crearQuad() {
  // chasis
  chassisBody = new CANNON.Body({ mass: 200, material: quadMaterial });
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.25, 0.9)), new CANNON.Vec3(0, 0.2, 0));
  chassisBody.position.copy(pos_inicial);

  // RaycastVehicle
  vehicle = new CANNON.RaycastVehicle({
    chassisBody: chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2
  });
  // opciones de las ruedas (recomendado por IA)
  var opcionesRueda = {
    radius: 0.35,
    directionLocal: new CANNON.Vec3(0, -1, 0),     // el rayo va hacia abajo
    suspensionRestLength: 0.4,                     // largo del muelle en reposo
    suspensionStiffness: 45,                       // rigidez del muelle
    maxSuspensionTravel: 0.35,
    dampingRelaxation: 2.5,                        // amortiguador al estirarse
    dampingCompression: 4.4,                       // amortiguador al comprimirse
    maxSuspensionForce: 100000,
    frictionSlip: 2.4,                             // agarre del neumatico
    rollInfluence: 0.05,                           // cuanto ayuda a volcar en las curvas
    axleLocal: new CANNON.Vec3(1, 0, 0),           // eje sobre el que gira la rueda
    chassisConnectionPointLocal: new CANNON.Vec3(),
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };
  // anclo las ruedas
  var anclajes = [[0.6, 0.7], [-0.6, 0.7], [0.6, -0.7], [-0.6, -0.7]];
  for (var i = 0; i < 4; i++) {
    opcionesRueda.chassisConnectionPointLocal.set(anclajes[i][0], 0, anclajes[i][1]);
    vehicle.addWheel(opcionesRueda);
  }
  vehicle.addToWorld(world);

  // visual simple
  quad = new THREE.Group();
  var matCarroceria = new THREE.MeshPhongMaterial({ color: 0xff66ff, shininess: 60 });
  var matNegro = new THREE.MeshPhongMaterial({ color: 0x222222 });

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
  var faro = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
  faro.position.set(0, 0.2, 0.92);
  quad.add(faro);
  scene.add(quad);
  quad.body = chassisBody;              // relacion fisica-visual como en seminario 4 fisicas

  // Ruedas: van sueltas en la escena porque su posicion la calcula el vehiculo
  var geoRueda = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 20);
  geoRueda.rotateZ(Math.PI / 2);        // el cilindro pasa a girar sobre el eje X
  for (var j = 0; j < 4; j++) {
    var rueda = new THREE.Mesh(geoRueda, matNegro);
    // una franja de color para ver que la rueda gira
    var franja = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.08, 0.6), matCarroceria);
    rueda.add(franja);
    scene.add(rueda);
    ruedas.push(rueda);
  }
}

function reiniciarQuad() {
  chassisBody.position.copy(pos_inicial);
  chassisBody.quaternion.set(0, 0, 0, 1);
  chassisBody.velocity.set(0, 0, 0);
  chassisBody.angularVelocity.set(0, 0, 0);
}

// Aplica los controles al vehiculo (se llama antes de world.step)
function controlarQuad(delta) {
  // velocidad hacia delante: proyeccion de la velocidad sobre el morro
  var adelante = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  var v = chassisBody.velocity.dot(adelante);

  // motor: en el RaycastVehicle una fuerza NEGATIVA empuja hacia +Z
  var fuerza = 0, freno = 0;
  if (controls.moveForward && v < velocidadMax) fuerza = -fuerzaMotor;
  if (controls.moveBackward) {
    if (v > 1) freno = fuerzaFreno;           // si vamos hacia delante, frena
    else fuerza = fuerzaMotor * 0.5;          // si estamos parados, marcha atras
  }
  if (controls.brake) freno = fuerzaFreno;
  for (var i = 0; i < 4; i++) {               // traccion a las 4 ruedas
    vehicle.applyEngineForce(fuerza, i);
    vehicle.setBrake(freno, i);
  }

  // direccion: solo giran las delanteras (0 y 1), y de forma suave
  var objetivo = 0;
  if (controls.moveLeft) objetivo += giroMax;
  if (controls.moveRight) objetivo -= giroMax;
  direccion += (objetivo - direccion) * Math.min(1, delta * 8);
  vehicle.setSteeringValue(direccion, 0);
  vehicle.setSteeringValue(direccion, 1);

  // para cuando vuelo
  var enElAire = true;
  for (var j = 0; j < 4; j++) if (vehicle.wheelInfos[j].raycastResult.hasHit) enElAire = false;//reviso si hay ruedas volando
  if (enElAire) {
    var wLocal = chassisBody.quaternion.conjugate().vmult(chassisBody.angularVelocity);
    var cabeceo = 0;
    if (controls.moveForward) cabeceo = -10;  //aplico una pequeña corrección para que no se me hunda el morro cuando salto, o el culo cuando salto para atras
    //si aplico una fuerza muy alta puedo hacer un backflip
    if (controls.moveBackward) cabeceo = 10;
    wLocal.x += (cabeceo - wLocal.x) * Math.min(1, delta * 4);
    chassisBody.quaternion.vmult(wLocal, chassisBody.angularVelocity);
  }
  if (enElAire) {
    var wLocal = chassisBody.quaternion.conjugate().vmult(chassisBody.angularVelocity);
    var lateral = 0;
    if (controls.moveLeft) lateral = 10;
    if (controls.moveRight) lateral = -10;

    wLocal.y += (lateral - wLocal.y) * Math.min(1, delta * 4);
    chassisBody.quaternion.vmult(wLocal, chassisBody.angularVelocity);

  }
}

// ---------------------------------------------------------------------------
// Camara 
// -----------------------------------------------------------------------------
function updateCamera(delta) {
  var pos = new THREE.Vector3().copy(chassisBody.position);

  // rumbo de la cámara
  var vel = new THREE.Vector3(chassisBody.velocity.x, 0, chassisBody.velocity.z);
  var morro = chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
  var dir;
  if (vel.length() > 3 && vel.x * morro.x + vel.z * morro.z > 0) dir = vel.normalize();
  else dir = new THREE.Vector3(morro.x, 0, morro.z).normalize();
  rumbo.lerp(dir, Math.min(1, delta * 3)).normalize();  // giro suave con interpolación linea

  // posición de la cámara como en el tron con variables globales
  var deseada = pos.clone().addScaledVector(rumbo, -distancia_camara);
  deseada.y = pos.y + altura_camara;
  // que no se salga de la arena, queda raro por ahora, alomejor poner límites sin pared directa para que no se quede la cámara por encima del vehículo sin verlo
  var radioMax = largo_arena / 2 - 12;
  var r = Math.hypot(deseada.x, deseada.z);
  if (r > radioMax) { deseada.x *= radioMax / r; deseada.z *= radioMax / r; }

  // calculo el moovimiento de la cámara con el muello
  var aceleracion = deseada.clone().sub(camera.position).multiplyScalar(rigidez)
    .addScaledVector(velCamara, -amortiguamiento);
  velCamara.addScaledVector(aceleracion, delta);         // v = v + a dt
  camera.position.addScaledVector(velCamara, delta);     // p = p + v dt

  // suavizar
  var mirar = pos.clone().addScaledVector(rumbo, 2);
  mirar.y += 1;//miro un poco para arriba
  objetivoCamara.lerp(mirar, Math.min(1, delta * 10));
  camera.lookAt(objetivoCamara);
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update() {
  if (quad === null) return;
  var delta = Math.min(clock.getDelta(), 0.05);   // evita saltos si el navegador se para

  controlarQuad(delta);
  world.step(1 / 60, delta, 3);

  // Sincronizar los mesh visuales con los cuerpos fisicos (s4-fisica-1.js)
  scene.traverse(function (obj) {
    if (obj.body !== undefined) {
      obj.position.copy(obj.body.position);
      obj.quaternion.copy(obj.body.quaternion);
    }
  });
  // las ruedas: posicion y giro calculados por el vehiculo
  for (var i = 0; i < 4; i++) {
    vehicle.updateWheelTransform(i);
    var t = vehicle.wheelInfos[i].worldTransform;
    ruedas[i].position.copy(t.position);
    ruedas[i].quaternion.copy(t.quaternion);
  }

  updateCamera(delta);
  stats.update();
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.render(scene, camera);
}
