import { ARButton, RealityAccelerator, VRButton } from 'ratk';
import {
	BoxGeometry,
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Scene,
	Vector3,
	WebGLRenderer,
	Color,
	Box3,
	CylinderGeometry,
	Matrix4,
} from 'three';
import * as TWEEN from "@tweenjs/tween.js";
import { Handy } from './handy/src/Handy.js'
import { Text } from 'troika-three-text';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { setupSfx, playCorrect, playGameOver, stopChargingAudio, playChargingAudio } from './soundEffects.js';
import { setupReferenceImage } from './assets/referenceImage.js';
import GhostHand from './ghost-hand.js';
import LoadingBar from './loadingbar.js';

// Game states
const GAME_STATE = {
	START: "start",
	ANSWERING: "ANSWERING",
	LOADING: "loading",
	END: "end"
}
let gameState = GAME_STATE.START;

const optionalFeatures = [
	'anchors',
	'plane-detection',
	'mesh-detection',
	'hit-test',
	'local-floor'
]

let isAR = false;
let isVR = false;

// Global variables for scene components
let camera, scene, renderer;
let cameraWorldPosition = new Vector3();
let leftHand, rightHand;
let ratk; // Instance of Reality Accelerator
let pendingAnchorData = null;
let handyLeft, handyRight;
let anchorCreated = false
let ghostHand = null;
let ghostHandModel = null;
let timeoutBoxHandId = null; // timeout for box hand
let loadingBar = null;
let questionIndex = 0;
let hitTestTarget = null;
let hitTestMarker = null;
let hitTestMarkerText = null;
let listenPose = false;

const successColor = new Color(0x66941B)
const defaultColor = new Color(0x000000)

// anchor model for the scene
let anchorModel, anchorText;

let questions = [];
let correctAnswer = null;
let userCorrectAnswerInterval = 0;
const correctIntervalThreshold = 1500;
const incorrectAnswerMultipler = 1.5;

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);

// Initialize and animate the scene
window.startGame = () => {
	init().then(() => {
		animate();
		// just for testing purpose, lets listen for space key
		window.addEventListener('keydown', (event) => {
			if (event.code == "Space" && window._debug) {
				if (questionIndex >= questions.length - 1) {
					playGameOver();
					endGame();
				} else {
					playCorrect();
					nextQuestion();
				}
			}
		});
	});
}

/**
 * Initializes the scene, camera, renderer, lighting, and AR functionalities.
 */
async function init() {
	gameState = GAME_STATE.START;

	scene = new Scene();
	setupCamera();
	setupLighting();
	setupRenderer();
	setupARButton();
	// setupVRButton();
	// We need to setup VR/AR mode first, once thats decided
	// then we can setup the controller and the rest of the scene
	setupController();
	await setupSfx(camera);
	window.addEventListener('resize', onWindowResize);
	setupReferenceImage(scene);
	setupRATK();

	// Ghost hand
	ghostHand = new GhostHand(scene)
	ghostHand.loadBoxHandModel('right').then((handModel) => {
		handModel.scale.set(1, 1, 1);
		handModel.position.set(0, 0.75, -1);
		// We need rotate the hand based on the character
		handModel.rotateX(Math.PI / 2);
		// handModel.rotateZ(Math.PI / -2); // thumb face toward us
		handModel.rotateZ(Math.PI / -1); // palm toward us
		ghostHandModel = handModel;
		scene.add(handModel);
		// var box = new BoxGeometry(0.05, 0.05, 0.05);
		// var material = new MeshBasicMaterial();
		// var cube = new Mesh(box, material);
		// cube.position.set(0, 0.75, -1);
		// scene.add(cube)
		// Rotate the handModel by 90 degrees
		// handModel.rotateX(Math.PI / 2);
	});
}


// Set up the anchor
function setupQuestionAnchor(anchor) {

	console.log("anchor is being loaded...")

	const group = new Group();
	anchorModel = new Group();
	anchorText = new Text();

	group.add(anchorText);
	group.add(anchorModel);

	if (anchor !== null) {
		// ensure the group is facing toward camera global position
		group.position.set(anchor.position.x, anchor.position.y, anchor.position.z);
		// calculate rotation toward user camera
		const rotationMatrix = new Matrix4();
		const eyePos = camera.position.clone();
		eyePos.y = 0;
		const anchorPos = anchor.position.clone();
		anchorPos.y = 0;
		rotationMatrix.lookAt(eyePos, anchorPos, new Vector3(0, 1, 0));
		group.quaternion.setFromRotationMatrix(rotationMatrix);
		hitTestMarker.parent = null; // detach from the hitTestTarget
		
		// detach from the hitTestTarget
		hitTestMarkerText.parent = null; 
		hitTestTarget.remove(hitTestMarkerText)
		hitTestMarkerText.dispose();
		// TODO: animate the hitTestMarker 


	} else {
		group.position.set(0, 0, -2.5);
	}

	scene.add(group);

	gameState = GAME_STATE.LOADING;

	fetch('./question.json')
		.then(response => response.json())
		.then(data => {
			// setupGroups(anchor)
			questions = data

			// setup loading bar
			loadingBar = new LoadingBar(scene)
			var bar = loadingBar.SetupLoadingBar(questions.length)
			group.add(bar)
			bar.position.set(0, 0, 0.4)
			loadingBar.UpdateLoadingBar(questionIndex + 1)

			setupQuestion(questions[questionIndex])
		});
}

/**
 * Sets up the camera for the scene.
 */
function setupCamera() {
	camera = new PerspectiveCamera(
		50,
		window.innerWidth / window.innerHeight,
		0.1,
		10,
	);
	// Hack for Handy
	window.camera = camera;
	camera.position.set(0, 1.6, 3);
	camera.lookAt(new Vector3(0, 0, 0))
}

async function setupQuestion(data) {
	// Read the Data
	// Replace the answer in the question with _

	anchorText.frustumCulled = false	// always render
	anchorText.anchorX = 'center';
	anchorText.anchorY = 'bottom';
	anchorText.fontSize = 1

	const loader = new GLTFLoader();
	console.log("loading...", data.model)
	gameState = GAME_STATE.LOADING;
	if (anchorModel.children.length > 0) {
		// play animation 
		await animateOut(anchorModel)
		anchorModel.remove(anchorModel.children[0])
		anchorText.text = "Loading..."
		anchorText.sync()
	}

	// TODO: instead of loading up the question one by one, 
	// We should load all the question at once to speed things up?
	loader.load(`./${data.model}`, function (gltf) {
		const question = data.word.replace(data.answer, "_")

		ghostHand.hideBoxhandModel();
		ghostHand.updateBoxHandPose(`asl ${data.answer.toLowerCase()}`);
		clearTimeoutBoxHand();
		// show ghost hand after 5 seconds
		timeoutBoxHandId = setTimeout(() => {
			ghostHand.showBoxHandModel();
		}, 5000);

		cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
		console.log(cameraWorldPosition)
		ghostHandModel.position.set(cameraWorldPosition.x + 0.1, cameraWorldPosition.y - 0.1, cameraWorldPosition.z - 0.3)
		// based on the position of the user camera, set it infront of it
		correctAnswer = data.answer
		anchorText.text = question
		anchorText.sync();

		// remove the model inside anchorModel 
		const model = gltf.scene;
		model.scale.set(1, 1, 1)
		model.frustumCulled = false	// always render
		model.position.set(0, 0, 0)

		const aabb = new Box3();
		aabb.setFromObject(model);

		// from the box3, get the height of the model and scale it to 1
		console.log(aabb.max.y)
		const scale = 0.60 / aabb.max.y
		console.log(scale)
		model.scale.set(scale, scale, scale)

		const height = (aabb.max.y - aabb.min.y) * scale / 2;
		model.position.y = height;

		anchorText.position.set(0, (aabb.max.y - aabb.min.y) * scale, -1)

		anchorModel.add(model);
		animateIn(anchorModel).then(() => {
			listenPose = true
			gameState = GAME_STATE.ANSWERING;
		})
	});

	// console.log("anchor is loaded!")
	// console.log(anchorModel)
	// console.log(anchorText)
	// TODO:
	// Animate the model (transition in)
	// Animate the model (transition out)
}

/**
 * Sets up the lighting for the scene.
 */
function setupLighting() {
	scene.add(new HemisphereLight(0x606060, 0x404040));
	const light = new DirectionalLight(0xffffff);
	light.position.set(1, 1, 1).normalize();
	scene.add(light);
}

/**
 * Sets up the renderer for the scene.
 */
function setupRenderer() {
	renderer = new WebGLRenderer({
		alpha: true,
		antialias: true,
		multiviewStereo: true,
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.xr.enabled = true;
	document.body.appendChild(renderer.domElement);
}

/**
 * Sets up the AR button and web launch functionality.
 */
function setupARButton() {
	const arButton = document.getElementById('ar-button');
	isAR = true;
	// display the AR button
	arButton.style.display = 'block';
	ARButton.convertToARButton(arButton, renderer, {
		requiredFeatures: [
			'hand-tracking',
			...optionalFeatures
		],
		onUnsupported: () => {
			isAR = false;
			arButton.style.display = 'none';
			setupVRButton();
		}
	});
}

function setupVRButton() {
	const vrButton = document.getElementById('vr-button');
	vrButton.style.display = 'block';
	isVR = true;
	VRButton.convertToVRButton(vrButton, renderer, {
		requiredFeatures: [
			'hand-tracking',
		],
		onUnsupported: () => {
			isVR = false;
			vrButton.style.display = 'none';
			setupWebLaunchButton();
		}
	});
}

function setupWebLaunchButton() {
	const webLaunchButton = document.getElementById('web-launch-button');
	webLaunchButton.onclick = () => {
		window.open(
			'https://www.oculus.com/open_url/?url=' +
			encodeURIComponent(window.location.href),
		);
	};
	webLaunchButton.style.display = 'block';
}

/**
 * Sets up the XR controller and its event listeners.
 */
function setupController() {
	const hand0 = renderer.xr.getHand(0);
	const hand1 = renderer.xr.getHand(1);
	[hand0, hand1].forEach(hand => setupHand(hand));
}

function setupHand(hand) {
	const handModelFactory = new XRHandModelFactory();
	hand.userData.currentHandModel = 0;
	const model = handModelFactory.createHandModel(hand, 'mesh');
	model.visible = true;
	hand.add(model);
	scene.add(hand);

	hand.addEventListener('connected', function (event) {
		// determine if it is left or right hand
		const handedness = event.data.handedness
		if (handedness == "left") {
			leftHand = hand;
			Handy.makeHandy(leftHand)
		} else if (handedness == "right") {
			rightHand = hand;
			Handy.makeHandy(rightHand)
			if (isAR) {
				handleControllerConnected.apply(this, [event]);
				rightHand.addEventListener('disconnected', handleControllerDisconnected);
				rightHand.addEventListener('pinchend', function () {
					ratk.anchors.forEach((anchor) => {
						console.log(anchor.anchorID);
						ratk.deleteAnchor(anchor);
					});

					if (anchorCreated == false) {
						console.log("pinch end")
						if (hitTestTarget == null) {
							console.warn("hit test target is null? how come");
							return;
						}

						pendingAnchorData = {
							position: hitTestTarget.position.clone(),
							quaternion: hitTestTarget.quaternion.clone(),
						};
						anchorCreated = true;
					}
				});
			}
		}
	});
}

/**
 * Handles controller connection events.
 */
function handleControllerConnected(event) {
	// start raycasting from hand
	ratk
		.createHitTestTargetFromControllerSpace(event.data.handedness)
		.then((testTarget) => {
			this.hitTestTarget = testTarget;
			const geometry = new CylinderGeometry(0.2, 0.2, 0.01, 32);
			const material = new MeshBasicMaterial({
				transparent: true,
				opacity: 0.5,
			});

			// Get a reference to the hit target outside of the scope of this function
			hitTestMarker = new Mesh(geometry, material);
			hitTestTarget = this.hitTestTarget;

			hitTestMarkerText = new Text();
			hitTestMarkerText.text = "Pinch Right Hand to start";
			hitTestMarkerText.frustumCulled = false	// always render
			hitTestMarkerText.anchorX = 'center';
			hitTestMarkerText.anchorY = 'bottom';
			hitTestMarkerText.fontSize = 0.1	
			this.hitTestTarget.add(hitTestMarkerText);
			hitTestMarkerText.position.set(0, 0.2, 0);

			this.hitTestTarget.add(hitTestMarker);
		});
}

/**
 * Handles controller disconnection events.
 */
function handleControllerDisconnected() {
	ratk.deleteHitTestTarget(this.hitTestTarget);
	this.hitTestTarget = null;
}

/**
 * Handles 'selectstart' event for the controller.
 */
function handleSelectStart() {
	if (this.hitTestTarget) {
		pendingAnchorData = {
			position: this.hitTestTarget.position.clone(),
			quaternion: this.hitTestTarget.quaternion.clone(),
		};
	}
}

/**
 * Handles 'squeezestart' event for the controller.
 */
function handleSqueezeStart() {
	ratk.anchors.forEach((anchor) => {
		console.log(anchor.anchorID);
		ratk.deleteAnchor(anchor);
	});
}

/**
 * Sets up the Reality Accelerator instance and its event handlers.
 */
function setupRATK() {
	ratk = new RealityAccelerator(renderer.xr);
	ratk.onPlaneAdded = handlePlaneAdded;
	ratk.onMeshAdded = handleMeshAdded;
	scene.add(ratk.root);
	renderer.xr.addEventListener('sessionstart', () => {

		//TODO: Here we need to know if the user is in AR or VR
		// if in AR, then we need to allow user to specify the anchor
		if (isAR) {
			setTimeout(() => {
				ratk.restorePersistentAnchors().then(() => {
					ratk.anchors.forEach((anchor) => {
						buildAnchorMarker(anchor, true);
					});
				});
			}, 1000);
			setTimeout(() => {
				if (ratk.planes.size == 0) {
					renderer.xr.getSession().initiateRoomCapture();
				}
			}, 5000);
		} else if (isVR) {
			// else in VR, we can just load the model infront of the user
			setupQuestionAnchor(null)
		}
	});
};

/**
 * Handles the addition of a new plane detected by RATK.
 */
function handlePlaneAdded(plane) {
	const mesh = plane.planeMesh;
	mesh.material = new MeshBasicMaterial({
		wireframe: true,
		color: Math.random() * 0xffffff,
	});
	mesh.visible = false;
}

/**
 * Handles the addition of a new mesh detected by RATK.
 */
function handleMeshAdded(mesh) {
	const meshMesh = mesh.meshMesh;
	meshMesh.material = new MeshBasicMaterial({
		wireframe: true,
		color: Math.random() * 0xffffff,
	});
	meshMesh.geometry.computeBoundingBox();
	const semanticLabel = new Text();
	meshMesh.add(semanticLabel);
	meshMesh.visible = false;
}

/**
 * Handles window resize events.
 */
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Animation loop for the scene.
 */
function animate() {
	renderer.setAnimationLoop(render);
}

let lastTime = 0;

/**
 * Render loop for the scene, updating AR functionalities.
 */
function render(arg) {
	const delta = arg - lastTime
	lastTime = arg
	TWEEN.update();
	handlePendingAnchors();
	ratk.update();
	updateSemanticLabels();
	const session = renderer.xr.getSession();

	if (gameState == GAME_STATE.ANSWERING) {
		// here we start listening to the pose
		listenRightHand(delta);
	}

	if (hitTestMarkerText != null) {
		hitTestMarkerText.lookAt(camera.position);
	}

	Handy.update()
	renderer.render(scene, camera);
}

function listenRightHand(delta) {
	if (handyRight == null) {
		handyRight = Handy.hands.getRight();
	}

	if (handyRight != null) {
		// Right Hand... 
		if (rightHand.isPose(`asl ${correctAnswer?.toLowerCase()}`, 3000)) {
			// Get the time away from last frame in threejs
			playChargingAudio(0);
			userCorrectAnswerInterval += delta;
			if (userCorrectAnswerInterval > correctIntervalThreshold) {
				clearTimeoutBoxHand();
				// transition to the next state
				if (questionIndex >= questions.length - 1) {
					playGameOver();
					endGame();
				} else {
					playCorrect();
					nextQuestion();
				}
			}
		} else {
			stopChargingAudio();
			if (userCorrectAnswerInterval > 0) {
				const newInterval = userCorrectAnswerInterval - (delta * incorrectAnswerMultipler);
				userCorrectAnswerInterval = newInterval > 0 ? newInterval : 0;
			}
		}
		handyRight?.traverse((child) => { if (child.material) child.material.color = new Color().lerpColors(defaultColor, successColor, userCorrectAnswerInterval / correctIntervalThreshold); });
	} else {
		console.warn("Handy Right is not setup")
	}
}

function clearTimeoutBoxHand() {
	if (timeoutBoxHandId !== null) {
		clearTimeout(timeoutBoxHandId);
		timeoutBoxHandId = null;
	}
}

function endGame() {
	gameState = GAME_STATE.END;

	animateOut(anchorModel).then(() => {
		anchorModel.remove(anchorModel.children[0])
		anchorText.text = "Thanks for Playing";
		anchorText.sync();
	})
}

function nextQuestion() {
	listenPose = false;
	gameState = GAME_STATE.LOADING;
	ghostHand.hideBoxhandModel();
	userCorrectAnswerInterval = correctIntervalThreshold;
	anchorText.text = anchorText.text.replace("_", correctAnswer);
	anchorText.sync();
	//todo: play success audio
	// next question
	setTimeout(() => {
		questionIndex += 1;
		loadingBar.UpdateLoadingBar(questionIndex + 1)
		setupQuestion(questions[questionIndex]);
	}, 1000);
}

/**
 * Handles the creation of anchors based on pending data.
 */
function handlePendingAnchors() {
	if (pendingAnchorData) {
		ratk
			.createAnchor(
				pendingAnchorData.position,
				pendingAnchorData.quaternion,
				true,
			)
			.then((anchor) => {
				setupQuestionAnchor(anchor)
			});
		pendingAnchorData = null;
	}
}

// This is from the sample project, where an anchor is created 
// when the user pinches the controller
function buildAnchorMarker(anchor, isRecovered) {
	const geometry = new BoxGeometry(0.05, 0.05, 0.05);
	const material = new MeshBasicMaterial({
		color: isRecovered ? 0xff0000 : 0x00ff00,
	});
	const cube = new Mesh(geometry, material);
	anchor.add(cube);
	console.log(
		`anchor created (id: ${anchor.anchorID}, isPersistent: ${anchor.isPersistent}, isRecovered: ${isRecovered})`,
	);
}

/**
 * Updates semantic labels for each mesh.
 */
function updateSemanticLabels() {
	ratk.meshes.forEach((mesh) => {
		const semanticLabel = mesh.userData.semanticLabelMesh;
		if (semanticLabel) {
			semanticLabel.lookAt(camera.position);
		}
	});
}

function animateIn(obj) {
	return new Promise((resolve) => {
		var originalPosition = obj.position.y;
		var originalScale = { x: 1, y: 1, z: 1 }
		obj.scale.set(0, 0, 0);

		obj.position.y = originalPosition - 1;
		const positionTween = new TWEEN.Tween(obj.position)
			.to({ y: originalPosition }, 1000) // Move upward to y = 2 in 2000 milliseconds (2 seconds)
			.easing(TWEEN.Easing.Linear.None)
			.start();

		const rotationTween = new TWEEN.Tween(obj.rotation)
			.to({ y: Math.PI * 2 }, 1000) // Rotate 360 degrees in 3000 milliseconds (3 seconds)
			.easing(TWEEN.Easing.Linear.None)
			.start();

		const scaleTween = new TWEEN.Tween(obj.scale)
			.to(originalScale, 1000) // Scale up to (1, 1, 1) in 2000 milliseconds (2 seconds)
			.easing(TWEEN.Easing.Linear.None)
			.start();

		// when scale, rotation, and positiiion are done, resolve the promise
		setTimeout(() => {
			resolve()
		}, 1000);
	})
}

function animateOut(obj) {
	return new Promise((resolve) => {
		const positionTween = new TWEEN.Tween(obj.position)
			.to({ y: 0 }, 250)
			.easing(TWEEN.Easing.Bounce.None)
			.start();

		// Create a Tween for scaling
		const scaleTween = new TWEEN.Tween(obj.scale)
			.to({ x: 0, y: 0, z: 0 }, 1000)
			.easing(TWEEN.Easing.Linear.None)
			.start();

		// when scale, rotation, and positiiion are done, resolve the promise
		setTimeout(() => {
			resolve()
		}, 1000);
	})
}
