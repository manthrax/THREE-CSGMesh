
/******** CANVAS RECORDER
Invoke with:
import CanvasRecorder from "./canvasrecorder.js"
CanvasRecorder( yourCanvas )
*/


/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

/* globals main */

// This code is adapted from
// https://rawgit.com/Miguelao/demos/master/mediarecorder.html
// tweaked by thrax


/* globals main, MediaRecorder */

let init = (canvas)=>{

    const mediaSource = new MediaSource();
    mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
    let mediaRecorder;
    let recordedBlobs;
    let sourceBuffer;

    //canvas //document.querySelector('canvas');
    const uiDiv = document.createElement('div')
    document.body.appendChild(uiDiv)
    uiDiv.id = 'canvasRecorder'
    uiDiv.style.position = 'absolute'
    uiDiv.style.left = uiDiv.style.top = '10px'



    let stream

let str_record = '⏺️'
let str_play = '▶️'
let str_stop = '⏹️'
let str_download = '↓'
let str_open = '+'
let str_close = '❎'
    uiDiv.innerHTML = `
<div style='zIndex:1000'>
<button id = 'record'>${str_record}</button>
<button id = 'play'>${str_play}</button>
<button id = 'download'>${str_download}</button>
<button id = 'close'>${str_close}</button>
</br>
<video style='width:640px;height:480px;display:none;' id='video'></video>
</div>
`
    const video = document.querySelector('video');

    const recordButton = document.querySelector('button#record');
    const playButton = document.querySelector('button#play');
    const downloadButton = document.querySelector('button#download');
    const closeButton = document.querySelector('button#close');

    recordButton.onclick = toggleRecording;
    playButton.onclick = play;
    downloadButton.onclick = download;
    closeButton.onclick = () =>{(closeButton.innerText = (video.style.display!==''?str_close:str_open)) && ( video.style.display = (video.style.display === '' ? 'none':''))}
    
    // Start the GL teapot on the canvas
    //main();

    function handleSourceOpen(event) {
        console.log('MediaSource opened');
        sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
        console.log('Source buffer: ', sourceBuffer);
    }

    function handleDataAvailable(event) {
        if (event.data && event.data.size > 0) {
            recordedBlobs.push(event.data);
        }
    }

    function handleStop(event) {
        console.log('Recorder stopped: ', event);
        const superBuffer = new Blob(recordedBlobs,{
            type: 'video/webm'
        });
        video.src = window.URL.createObjectURL(superBuffer);
    }

    function toggleRecording() {
        if (recordButton.textContent ===  str_record) {
            startRecording();
        } else {
            stopRecording();
            recordButton.textContent = str_record;
            playButton.disabled = false;
            downloadButton.disabled = false;
            closeButton.innerText = str_close
            video.style.display = ''
        }
    }
    function startCapture(){


        stream = canvas.captureStream();
        // frames per second
        console.log('Started stream capture from canvas element: ', stream);
    }
    // The nested try blocks will be simplified when Chrome 47 moves to Stable
    function startRecording() {

if(!stream)
    startCapture()


        let options = {
            mimeType: 'video/webm',

//      audioBitsPerSecond : 128000,
//      videoBitsPerSecond : 2500000,

      audioBitsPerSecond : 0,//128000,
      videoBitsPerSecond : 25000000,

        };
        recordedBlobs = [];
        try {
            mediaRecorder = new MediaRecorder(stream,options);
        } catch (e0) {
            console.log('Unable to create MediaRecorder with options Object: ', e0);
            try {
                options = {
                    mimeType: 'video/webm,codecs=vp9'
                };
                mediaRecorder = new MediaRecorder(stream,options);
            } catch (e1) {
                console.log('Unable to create MediaRecorder with options Object: ', e1);
                try {
                    options = 'video/vp8';
                    // Chrome 47
                    mediaRecorder = new MediaRecorder(stream,options);
                } catch (e2) {
                    alert('MediaRecorder is not supported by this browser.\n\n' + 'Try Firefox 29 or later, or Chrome 47 or later, ' + 'with Enable experimental Web Platform features enabled from chrome://flags.');
                    console.error('Exception while creating MediaRecorder:', e2);
                    return;
                }
            }
        }
        console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
        recordButton.textContent = str_stop;//'Stop Recording';
        playButton.disabled = true;
        downloadButton.disabled = true;
        mediaRecorder.onstop = handleStop;
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.start(100);
        // collect 100ms of data
        console.log('MediaRecorder started', mediaRecorder);
    }

    
    function stopCapture(){
        let tracks = mediaRecorder.stream.getTracks()
        tracks[0].stop()
        stream = null
    }

    function stopRecording() {
        mediaRecorder.stop();
        console.log('Recorded Blobs: ', recordedBlobs);
        video.controls = true;
        stopCapture()
    }

    function play() {
        video.play();
    }

    function download() {
        const blob = new Blob(recordedBlobs,{
            type: 'video/webm'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'test.webm';
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
        , 100);
    }
}


export default init
