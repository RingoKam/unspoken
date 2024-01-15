import { 
    Group, 
    MeshBasicMaterial, 
    InstancedMesh, 
    SphereGeometry, 
    MeshStandardMaterial, 
    DynamicDrawUsage, 
    Object3D,
    LineBasicMaterial,
    Vector3,
    BufferGeometry,
    Line,
    Matrix4
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { poses as leftPoses } from "./handy/src/Handy-poses-left.js"
import { poses as rightPoses } from "./handy/src/Handy-poses-right.js"

const DEFAULT_HAND_PROFILE_PATH = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/';

// joint connection map 
const wristLine = { origin: 0, line: [1, 5, 10, 15, 20] };
const thumbLine = { origin: 1, line: [2, 3, 4] };
const indexLine = { origin: 5, line: [6, 7, 8, 9] };
const middleLine = { origin: 10, line: [11, 12, 13, 14] };
const ringLine = { origin: 15, line: [16, 17, 18, 19] };
const pinkyLine = { origin: 20, line: [21, 22, 23, 24] };

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
    constructor(scene) {
        this.scene = scene;
        this.bones = [];
        this.boneBox = {};
        this.loader = new GLTFLoader();
        this.handedness = null;
        this.loader.setPath(DEFAULT_HAND_PROFILE_PATH);
        this.handModel = new Group();
        this.fingerLinesObj = null;
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

            this.handModel.add(handMesh);

            resolve(this.handModel);
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
                dummy.position.set(x, y, z);
                dummy.position.multiplyScalar(0.001);
                dummy.updateMatrix();
                console.log(dummy.position)
                this.boxInstancedMesh.setMatrixAt(i, dummy.matrix);
            }
        }
        // draw line between points
        this.updatePointInBetween();
    }

    updatePointInBetween() {
        // Draw wrist line
        // SetPixelRatio
        const material = new LineBasicMaterial({ 
            color: "white", 
            visible: true,
            linewidth: 2
        });
        const originPosition = new Vector3(0, 0, 0);
        const dummy = new Vector3()
        let matrix = new Matrix4();

        const { line, origin } = wristLine
        this.boxInstancedMesh.getMatrixAt(origin, matrix);
        dummy.setFromMatrixPosition(matrix);
		originPosition.copy(dummy)

        // create the 5 lines for the fingers
        if(this.fingerLinesObj == null) {
            this.fingerLinesObj = Array.from({length: 10}).map(() => {
                const geometry = new BufferGeometry();
                const line = new Line(geometry, material);
                line.frustumCulled = false;
                line.castShadow = false;
                line.receiveShadow = false;
                this.handModel.add(line);
                return line;
            });
        }
        // draw a line that connect the origin with each line
        for (let i = 0; i < line.length; i++) {
            // get the hand instance
            // dummy.position.set(0, 0, 0);
            const linePosition = new Vector3(0, 0, 0);
            this.boxInstancedMesh.getMatrixAt(line[i], matrix);
            dummy.setFromMatrixPosition(matrix);
            linePosition.copy(dummy)
            console.log(originPosition, linePosition)
            this.fingerLinesObj[i].geometry.setFromPoints([originPosition, linePosition])
            // const geometry = new BufferGeometry().setFromPoints([originPosition, linePosition]);
            // const wristLine = new Line(geometry, material);
            // wristLinel.BufferGeometry.setFromPoints([originPosition, linePosition])
            // wristLine.frustumCulled = false;
            // wristLine.castShadow = false;
            // wristLine.receiveShadow = false;
            // this.handModel.add(wristLine);
        }

        // draw rest of the lines
        const fingerLines = [thumbLine, indexLine, middleLine, ringLine, pinkyLine];
        fingerLines.forEach((finger, i) => {
            const { line, origin } = finger
            this.boxInstancedMesh.getMatrixAt(origin, matrix);
            dummy.setFromMatrixPosition(matrix);
            originPosition.copy(dummy)

            const posLines = [originPosition];
            // draw a line that connect the origin with each line
            for (let i = 0; i < line.length; i++) {
                // get the hand instance
                // dummy.position.set(0, 0, 0);
                const linePosition = new Vector3(0, 0, 0);
                this.boxInstancedMesh.getMatrixAt(line[i], matrix);
                dummy.setFromMatrixPosition(matrix);
                linePosition.copy(dummy)
                posLines.push(linePosition)
            }
            this.fingerLinesObj[5 + i].geometry.setFromPoints(posLines)
            // this.handModel.add(anotherFingerLine);
        })        
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