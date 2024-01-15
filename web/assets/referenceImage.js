import { TextureLoader, PlaneGeometry, MeshBasicMaterial, Vector3, Mesh } from 'three'

let signImage;
var right = new Vector3(1, 0, 0);

const setupReferenceImage = (scene) => {
    const mesh = loadImage('img/asl_signs.png')
	const size = 0;
	mesh.scale.set(size, size, size)
    scene.add(mesh)
    signImage = mesh
}

function loadImage(imagePath) {
	const textureLoader = new TextureLoader();
	const texture = textureLoader.load(imagePath);
	const geometry = new PlaneGeometry(1, 1);
	const material = new MeshBasicMaterial({ map: texture });
	const mesh = new Mesh(geometry, material);

	return mesh;
}

const enlargeScale = 0.25;
const shrinkScale = 0.05;
let once = false
const followPlayerHand = (hand) => {
    // console.log(hand.getWorldPosition())
    // get hand position
    // is hand model inside facing up?
    // if so, enlarge image
    // else, shrink image
    right.applyQuaternion(hand.quaternion);
    right.normalize();
    const dot = right.dot(new Vector3(0, 1, 0));
    
    if(!once) {
        hand.add(signImage) 
        once = true
    }

    if(dot > 0.1) {
        signImage.scale.set(enlargeScale, enlargeScale, enlargeScale)
    } else {
        signImage.scale.set(shrinkScale, shrinkScale, shrinkScale)
    }
} 

export {
    setupReferenceImage,
    followPlayerHand
}