import { Group, MeshBasicMaterial, InstancedMesh, SphereGeometry, MeshStandardMaterial, DynamicDrawUsage, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { poses as leftPoses } from "./handy/src/Handy-poses-left.js"
import { poses as rightPoses } from "./handy/src/Handy-poses-right.js"

const DEFAULT_HAND_PROFILE_PATH = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/';

// Joints are ordered from wrist outwards
const joints = [
    'wrist',
    'thumb-metacarpal',
    'thumb-phalanx-proximal',
    'thumb-phalanx-distal',
    'thumb-tip',
    'index-finger-metacarpal',
    'index-finger-phalanx-proximal',
    'index-finger-phalanx-intermediate',
    'index-finger-phalanx-distal',
    'index-finger-tip',
    'middle-finger-metacarpal',
    'middle-finger-phalanx-proximal',
    'middle-finger-phalanx-intermediate',
    'middle-finger-phalanx-distal',
    'middle-finger-tip',
    'ring-finger-metacarpal',
    'ring-finger-phalanx-proximal',
    'ring-finger-phalanx-intermediate',
    'ring-finger-phalanx-distal',
    'ring-finger-tip',
    'pinky-finger-metacarpal',
    'pinky-finger-phalanx-proximal',
    'pinky-finger-phalanx-intermediate',
    'pinky-finger-phalanx-distal',
    'pinky-finger-tip',
];



export default class GhostHand {
    constructor() {
        this.bones = [];
        this.boneBox = {};
        this.loader = new GLTFLoader();
        this.handedness = null;
        this.loader.setPath(DEFAULT_HAND_PROFILE_PATH);

        // instancedMesh for boxes
        this.boxInstancedMesh = null;
    }


    loadBoxHandModel(handedness) {
        this.handedness = handedness;

        return new Promise((resolve, reject) => {
            const geometry = new SphereGeometry(0.005, 10, 10);
            const material = new MeshBasicMaterial({
                color: '#95c6eb',
                transparent: true,
                opacity: 0.7
            });

            const handMesh = new InstancedMesh(geometry, material, joints.length);
            handMesh.frustumCulled = false;
            handMesh.instanceMatrix.setUsage(DynamicDrawUsage); // will be updated every frame
            handMesh.castShadow = true;
            handMesh.receiveShadow = true;
            this.boxInstancedMesh = handMesh

            const handModel = new Group();
            handModel.add(handMesh);
        
            resolve(handModel);
        })
    }

    updateBoxHandPose(poseName) {
        if (this.boxInstancedMesh == null) return;
        const poses = this.handedness === 'left' ? leftPoses : rightPoses;
        const selectedPose = poses.find(pose => pose.names.find(name => name == poseName));
        const jointPositions = selectedPose.jointPositions;
        
        const dummy = new Object3D()

        for (let i = 0; i < joints.length; i++) {
            const jointPos = jointPositions[i];
            if (jointPos !== undefined) {
                const [x, y, z] = jointPos;
                dummy.position.set(x,y,z);
                dummy.position.multiplyScalar(0.001);
                dummy.updateMatrix();
                console.log(dummy.position)
                this.boxInstancedMesh.setMatrixAt(i, dummy.matrix);
            }
        }
    }

    // this works, however we current don't track rotational data in threejs
    // will need to investigate how to add the rotational data
    // @handness: 'left' or 'right'
    loadHandModel(handedness) {
        this.handedness = handedness;
        return new Promise((resolve, reject) => {
            this.loader.load(`${handedness}.glb`, gltf => {
                const object = gltf.scene.children[0];
                const handModel = new Group();
                handModel.add(object);

                const material = new MeshBasicMaterial({
                    color: '#95c6eb',
                    transparent: true,
                    opacity: 0.4
                });

                const mesh = object.getObjectByProperty('type', 'SkinnedMesh');
                mesh.frustumCulled = false;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.material = material;

                joints.forEach(jointName => {
                    const bone = object.getObjectByName(jointName);
                    if (bone !== undefined) {
                        bone.jointName = jointName;
                    } else {
                        console.warn(`Couldn't find ${jointName} in ${handedness} hand mesh`);
                    }
                    // the order of the bones should match the order of the joints 
                    this.bones.push(bone);
                });
                resolve(handModel);
            }, undefined, reject)
        })
    }


    updateHandPose(poseName) {
        if (this.bones.length === 0) return;
        const poses = this.handedness === 'left' ? leftPoses : rightPoses;
        const selectedPose = poses.find(pose => pose.names.find(name => name == poseName));
        const jointPositions = selectedPose.jointPositions;

        // Adjust positions
        for (let i = 0; i < this.bones.length; i++) {
            const bone = this.bones[i];
            const jointPos = jointPositions[i];
            if (bone !== undefined && jointPos !== undefined) {
                const [x, y, z] = jointPos;
                console.log(x * 0.001, y * 0.001, z * 0.001)
                console.log(bone.position)

                bone.position.set(x, y, z);
                bone.position.multiplyScalar(0.001)
            } else {
                console.warn(`Couldn't find bone or jointPos for ${selectedPose.names}`);
            }
        }
    }
}   