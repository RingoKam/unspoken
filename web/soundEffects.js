import * as THREE from 'three'

const audioFiles = {
    charging: "audio/charging.mp3",
    correct: "audio/correct.mp3",
    gameover: "audio/gameover.mp3"
}

const audios = {}

// Load audio files
const setupSfx = async (camera) => {
    const listener = new THREE.AudioListener();
    camera.add(listener);

    // Load the audio file
    const audioLoader = new THREE.AudioLoader();

    var progress = Object.entries(audioFiles).map(async([key, value]) => {
        const audio = new THREE.Audio(listener);
        const buffer = await audioLoader.loadAsync(value)
        audio.setBuffer(buffer);
        audio.setLoop(false);
        audio.setVolume(1);
        audios[key] = audio;
    })

    await Promise.all(progress) 
    return audios;
}

const playCorrect = () => {
    audios.correct.play();
}

const playGameOver = () => {
    audios.gameover.play();
}   

// Progress, from 0 to 1, where 1 is fully charged
const playChargingAudio = (progress) => {
    const charging = audios.charging;
    if (charging.isPlaying) {
        return;
    }
    
    // // Seek to the correct position
    // charging.source = charging.context.createBufferSource();
    // charging.source.buffer = charging.buffer;
    // charging.source.connect(charging.context.destination);
    // charging.source.start(0, charging.buffer.duration * progress);
    charging.play();
}

const stopChargingAudio = () => {
    if(audios.charging.isPlaying) {
        audios.charging.stop();
    }
}

export {
    setupSfx,
    playCorrect,
    playGameOver,
    playChargingAudio,
    stopChargingAudio
}