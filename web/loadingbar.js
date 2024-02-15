import { BoxGeometry, MeshBasicMaterial, Group, Mesh } from 'three'

const backgroundColor = "#3e3e3e";
const solidColor = "#ffffff";

export default class LoadingBar {
    
    constructor(scene) {
        this.scene = scene;
    }

    SetupLoadingBar(totalCount) {
        this.group = new Group();
        const length = 1;
        const geometry = new BoxGeometry(length, 0.1, 0.005);
        const material = new MeshBasicMaterial({color: backgroundColor});
        this.backdropMesh = new Mesh(geometry, material);

        this.group.add(this.backdropMesh);
        this.indiciatorBarGroup = new Group();
        this.group.add(this.indiciatorBarGroup);
        const margin = 0.01;
        const indicatorWidth = length / totalCount / 2;
        this.indiciatorBarGroup.position.set(-0.5 + indicatorWidth, 0, 0.005);

        // create actual counter
        const tickMaterial = new MeshBasicMaterial({color: solidColor});
        for(var i = 0; i < totalCount; i++) {
            const geometry = new BoxGeometry(indicatorWidth, 0.05, 0.001);
            const mesh = new Mesh(geometry, tickMaterial);
            this.indiciatorBarGroup.add(mesh);
            mesh.position.set((indicatorWidth + indicatorWidth) * i, 0, -0.005);
        }

        this.scene.add(this.group);

        return this.group;
    }

    UpdateLoadingBar(currentCount) {
        // loop thru the indicator bar group
        for(var i = 0; i < this.indiciatorBarGroup.children.length; i++) {
            const mesh = this.indiciatorBarGroup.children[i];
            if (i < currentCount) {
                this.indiciatorBarGroup.children[i].position.z = 0;
            } else {
                this.indiciatorBarGroup.children[i].position.z = -0.005;
            }
        }
    }
}