/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ARButton, RealityAccelerator } from 'ratk';
import {
	BoxGeometry,
	BufferGeometry,
	DirectionalLight,
	Group,
	HemisphereLight,
	Line,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Scene,
	SphereGeometry,
	Vector3,
	WebGLRenderer,
	Color,
	Box3
} from 'three';
import { Handy } from './handy/src/Handy.js'
import { Text } from 'troika-three-text';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { update, loadPose, getMatchedPoses } from './handyworks/build/esm/handy-work.standalone.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Global variables for scene components
let camera, scene, renderer;
let controller1, controller2;
let hand1, hand2;
let controllerGrip1, controllerGrip2;
let ratk; // Instance of Reality Accelerator
let pendingAnchorData = null;
let handyLeft, handyRight;
const groupList = []
let anchorCreated = false

const successColor = new Color(0x66941B)
const defaultColor = new Color(0x000000)

// anchor model for the scene
let anchorModel, anchorText;
let text1, group1;

let questions = [];
let correctAnswer = null;
let userCorrectAnswerInterval = 0;
const correctIntervalThreshold = 3000;
const incorrectAnswerMultipler = 1.5;

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);

const handModels = {
	left: null,
	right: null
};

let listenPose = false

// Initialize and animate the scene
init();
animate();

/**
 * Initializes the scene, camera, renderer, lighting, and AR functionalities.
 */
function init() {

	scene = new Scene();
	// setupGroups()
	setupCamera();
	setupLighting();
	setupRenderer();
	setupARButton();
	setupController();
	window.addEventListener('resize', onWindowResize);
	setupRATK();

}

let questionIndex = 0;

// Set up the anchor
function setupAnchor(anchor) {

	console.log("anchor is being loaded...")

	const group = new Group();
	anchorModel = new Group();
	anchorText = new Text();

	group.add(anchorText);
	group.add(anchorModel);
	group.position.set(0, 0, -2);
	scene.add(group);

	fetch('./question.json')
		.then(response => response.json())
		.then(data => {
			// setupGroups(anchor)
			questions = data
			setupQuestion(questions[0])
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

function setupQuestion(data) {
	// Read the Data
	// Replace the answer in the question with _

	anchorText.frustumCulled = false	// always render
	anchorText.anchorX = 'center';
	anchorText.anchorY = 'bottom';
	anchorText.fontSize = 1

	const loader = new GLTFLoader();
	console.log("loading...", data.model)
	if(anchorModel.children.length > 0) {
		anchorModel.remove(anchorModel.children[0])
		anchorText.text = "Loading..."
		anchorText.sync()
	}
	loader.load(`./${data.model}`, function (gltf) {
		const question = data.word.replace(data.answer, "_")
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

		listenPose = true
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
	const webLaunchButton = document.getElementById('web-launch-button');
	webLaunchButton.onclick = () => {
		window.open(
			'https://www.oculus.com/open_url/?url=' +
			encodeURIComponent(window.location.href),
		);
	};

	ARButton.convertToARButton(arButton, renderer, {
		requiredFeatures: [
			'anchors',
			'plane-detection',
			'hit-test',
			'mesh-detection',
			'hand-tracking',
			'local-floor',
			'hand-tracking'
		],
		onUnsupported: () => {
			arButton.style.display = 'none';
			webLaunchButton.style.display = 'block';
		},
	});
}

/**
 * Sets up the XR controller and its event listeners.
 */
function setupController() {
	controller1 = renderer.xr.getController(0);
	scene.add(controller1);

	controller2 = renderer.xr.getController(1);
	scene.add(controller2);

	// const controllerModelFactory = new XRControllerModelFactory();
	const handModelFactory = new XRHandModelFactory();

	// Hand 1
	controllerGrip1 = renderer.xr.getControllerGrip(0);
	// controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
	scene.add(controllerGrip1);

	hand1 = renderer.xr.getHand(0);
	hand1.userData.currentHandModel = 0;

	scene.add(hand1);

	handModels.left = [
		handModelFactory.createHandModel(hand1, 'mesh'),
		handModelFactory.createHandModel(hand1, 'spheres'),
		handModelFactory.createHandModel(hand1, 'boxes')
	];

	handModels.left[0].visible = true;
	handModels.left[1].frustumCulled = false;
	hand1.add(handModels.left[0]);

	// console.log(hand1);

	hand1.addEventListener('pinchend', function () {
		if (anchorCreated == false) {
			pendingAnchorData = {
				position: hand1.position.clone(),
				quaternion: hand1.quaternion.clone(),
			};
			anchorCreated = true;
		}
	});

	// Hand 2

	controllerGrip2 = renderer.xr.getControllerGrip(1);
	// controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
	scene.add(controllerGrip2);

	hand2 = renderer.xr.getHand(1);
	hand2.userData.currentHandModel = 0;
	scene.add(hand2);

	handModels.right = [
		handModelFactory.createHandModel(hand2, 'mesh'),
		handModelFactory.createHandModel(hand2, 'spheres'),
		handModelFactory.createHandModel(hand2, 'boxes')
	];

	for (let i = 0; i < 3; i++) {
		const model = handModels.right[i];
		model.visible = i == 0;
		hand2.add(model);
	}

	hand2.addEventListener('pinchend', function () {
		if (anchorCreated == false) {
			pendingAnchorData = {
				position: hand1.position.clone(),
				quaternion: hand1.quaternion.clone(),
			};
			anchorCreated = true;
		}
	});

	Handy.makeHandy(hand1)
	Handy.makeHandy(hand2)

	if (handyLeft == null) {
		handyLeft = Handy.hands.getLeft()
		if (handyLeft) {
			console.log("found left!")
			handyLeft.addEventListener("pose changed", (event) => {
				// console.log(event.message)
			})
		}
	}
	if (handyRight) {
		handyRight = Handy.hands.getRight()
		if (handyRight) {
			console.log("found right!")
			handyRight.addEventListener("pose changed", (event) => {
				// console.log(event.message)
			})
		}
	}
}

/**
 * Handles controller connection events.
 */
function handleControllerConnected(event) {
	ratk
		.createHitTestTargetFromControllerSpace(event.data.handedness)
		.then((hitTestTarget) => {
			this.hitTestTarget = hitTestTarget;
			const geometry = new SphereGeometry(0.05);
			const material = new MeshBasicMaterial({
				transparent: true,
				opacity: 0.5,
			});
			const hitTestMarker = new Mesh(geometry, material);
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
		setTimeout(() => {
			ratk.restorePersistentAnchors().then(() => {
				ratk.anchors.forEach((anchor) => {
					console.log(anchor.anchorID);
					ratk.deleteAnchor(anchor);
				});
				// if (ratk.anchors.length > 0) {
				// 	anchorCreated = true;
				// 	setupAnchor(ratk.anchors[0]);
				// }
			});
		}, 1000);
		setTimeout(() => {
			if (ratk.planes.size == 0) {
				renderer.xr.getSession().initiateRoomCapture();
			}
		}, 5000);
	});
}

function setupGroups(anchor) {
	group1 = new Group()
	text1 = new Text()
	text1.text = 'L_MP'
	// text1.position.set(-2, 2, -2)
	text1.anchorX = 'center';
	text1.anchorY = 'bottom';
	text1.frustumCulled = false	// always render
	text1.fontSize = 1

	group1.add(text1)

	const loader = new GLTFLoader();
	loader.load('/models/lamp.glb', function (gltf) {
		const model = gltf.scene;
		// Get bounding box of the model 
		model.scale.set(1, 1, 1)
		model.frustumCulled = false	// always render
		model.position.set(0, 0, -2)
		const aabb = new Box3();
		aabb.setFromObject(model);
		const height = (aabb.max.y - aabb.min.y) / 2;
		model.position.y = height;
		group1.add(model);

		text1.position.set(0, (aabb.max.y - aabb.min.y), -2)
	});
	// TODO: should be directly infront of user
	group1.position.set(0, 0, -2);
	scene.add(group1)

	// start listening for the pose
	listenPose = true
}

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
	// semanticLabel.text = mesh.semanticLabel;
	// semanticLabel.anchorX = 'center';
	// semanticLabel.anchorY = 'bottom';
	// semanticLabel.fontSize = 0.1;
	// semanticLabel.color = 0x000000;
	// semanticLabel.sync();
	// semanticLabel.position.y = meshMesh.geometry.boundingBox.max.y;
	// mesh.userData.semanticLabelMesh = semanticLabel;
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

	handlePendingAnchors();
	ratk.update();
	updateSemanticLabels();

	const session = renderer.xr.getSession();
	// if (session) {
	// 	const frame = renderer.xr.getFrame();
	// 	const referenceSpace = renderer.xr.getReferenceSpace();
	// 	const xrInputSources = session.inputSources;
	// 	update(xrInputSources, referenceSpace, frame, (arg) => {
	// 		console.log(arg);
	// 	});
	// }

	// Let's disable left hand input for now
	// LEFT HAND
	if (handyLeft == null) {
		handyLeft = Handy.hands.getLeft()
		// if(handyLeft) {
		// 	console.log("left hand event registered")
		// 	handyLeft.addEventListener("pose changed", (event) => {
		// 		// console.log(event.message)
		// 	})
		// }
	} else if (listenPose) {
		// if(handyLeft.isPose('asl a', 3000)) {
		// 	handyLeft.traverse((child) => { if(child.material) child.material.color = new Color( "green" ) })
		// } else {
		// 	handyLeft.traverse((child) => { if(child.material) child.material.color = new Color("gray") })
		// }
	}

	// RIGHT HAND
	if (handyRight == null) {
		handyRight = Handy.hands.getRight()
		if (handyRight) {
			console.log("right hand event registered")
			handyRight.addEventListener("pose changed", (event) => {
				console.log(event.message)
			})
		}
	} else if (listenPose) {
		if (hand2.isPose(`asl ${correctAnswer?.toLowerCase()}`, 3000)) {
			// Get the time away from last frame in threejs
			userCorrectAnswerInterval += lastTime
			if (userCorrectAnswerInterval > correctIntervalThreshold) {
				// user has held the pose for 3 seconds
				// transition to the next state
				// Play success audio 
				listenPose = false
				userCorrectAnswerInterval = correctIntervalThreshold;
				anchorText.text = anchorText.text.replace("_", correctAnswer)
				anchorText.sync()
				// next question
				setTimeout(() => {
					questionIndex += 1
					setupQuestion(questions[questionIndex])
				}, 3000);
			}
			// if time reached 3 seconds, then user has held the pose for 3 seconds
		} else {
			if (userCorrectAnswerInterval > 0) {
				const newInterval = userCorrectAnswerInterval - (lastTime * incorrectAnswerMultipler)
				userCorrectAnswerInterval = newInterval > 0 ? newInterval : 0
			}
		}
		// console.log(userCorrectAnswerInterval)
		handyRight.traverse((child) => { if (child.material) child.material.color = new Color().lerpColors(defaultColor, successColor, userCorrectAnswerInterval / 3000) })
	}
	Handy.update()
	renderer.render(scene, camera);
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
				setupAnchor(anchor)
			});
		pendingAnchorData = null;
	}
}

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
