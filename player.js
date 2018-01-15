const fs = require('fs');
const ws = require('wavesurfer.js');
const tl = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
const mm = require('wavesurfer.js/dist/plugin/wavesurfer.minimap.js');
const rg = require('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const jt = require("jsmediatags");
const mt = require("music-tempo");

var wave_color = 'rgb(233,187,52)';
var px_per_sec = 1;
var tempoData;
var sec_per_px;

var cuePoints  = [0,0,0,0];
var track_path = '../djplayer/snd/NOHA - Tu Cafe (Defkline, Red Polo & JFB remix).mp3';
var wavesurfer = ws.create({
    container: '#deck-waveform',
    waveColor: wave_color,
    barWidth: '1',
    hideScrollbar: true,
    cursorColor: '#6F2F25',
    progressColor: 'rgb(233,187,52)',
    cursorWidth: 2,
    autoCenter: true,

    plugins: [
            tl.create({
                container: '#deck-waveform-timeline',
                primaryColor: 'rgb(30,150,170)',
                secondaryColor: 'rgb(30,150,170)',
                secondaryFontColor: 'rgb(73,229,237)',
                primaryFontColor: 'rgb(73,229,237)',
                fontSize: 10,
                height: 12
            }),
            mm.create({
                container: '#deck-waveform-minimap',
                height: 30,
                waveColor: '#FFF',
                progressColor: '#BBB',
                cursorColor: '#68A93D',
                showOverview: true,
                showRegions: true,
                deferInit: true
            }),
            rg.create()
    ]
});




jt.read(track_path, {
  onSuccess: function(tag) {
    console.log(tag);
  },
  onError: function(error) {
    console.log(':(', error.type, error.info);
  }
});


wavesurfer.load(track_path);

wavesurfer.on('ready', function () {
  wavesurfer.enableDragSelection({});
  wavesurfer.zoom(px_per_sec);

  setTimeout(function(){
    wavesurfer.initPlugin('minimap');
  }, 1);

  sec_per_px = wavesurfer.backend.buffer.duration / wavesurfer.drawer.width;
  getTempoData(wavesurfer.backend.buffer);
  bindDeckControls();
});


function getTempoData(buffer) {
  var audioData = [];
  // Take the average of the two channels
  if (buffer.numberOfChannels == 2) {
    var channel1Data = buffer.getChannelData(0);
    var channel2Data = buffer.getChannelData(1);
    var length = channel1Data.length;
    for (var i = 0; i < length; i++) {
      audioData[i] = (channel1Data[i] + channel2Data[i]) / 2;
    }
  } else {
    audioData = buffer.getChannelData(0);
  }

  tempoData = new mt(audioData);

  drawTempoData();

  console.log(tempoData.tempo);
  console.log(tempoData.beats);
}

function bindDeckControls(){
  let d = document;
  let elements = document.getElementsByClassName('btn_deck_set_cue_point');

  d.querySelector('#btn_deck_play').addEventListener('click', ()=>{
    wavesurfer.play();
  })

  d.querySelector('#btn_deck_stop').addEventListener('click', ()=>{
    wavesurfer.stop();
  })

  d.querySelector('#btn_deck_pause').addEventListener('click', ()=>{
    wavesurfer.pause();
  })

  d.querySelector('#zoom-slider').addEventListener('input', (e)=>{
    px_per_sec = parseInt(e.target.value);
    wavesurfer.zoom(px_per_sec);
    wavesurfer.minimap.render();
  });

  d.querySelector('#deck-waveform-minimap').addEventListener('mouseup', (e)=>{
    wavesurfer.seekAndCenter((e.clientX - 8) / wavesurfer.drawer.getWidth());
  });

  for (var i = 0; i < elements.length; i++) {
    elements[i].addEventListener('click', (e)=>{
      addCuePoint(parseInt(e.target.dataset.number) - 1);
    });
  }
}

function addCuePoint(cuePoint){
  let currentTime = wavesurfer.getCurrentTime();

  wavesurfer.addRegion({
    start:  currentTime, // time in seconds
    end:    currentTime + 0.1, // time in seconds
    color:  'red',
    loop:   false
  });

  cuePoints[cuePoint] = currentTime;
  wavesurfer.params.waveColor = 'green';
  wavesurfer.drawer.fillRect(150, 0, 1, wavesurfer.drawer.height);
  wavesurfer.params.waveColor = wave_color;
}

function drawTempoData(){
  wavesurfer.params.waveColor = 'brown';
  wavesurfer.drawer.drawBars(tempoData.beats, 0, 0, 0);

  // for (var i = 0; i < tempoData.beats.length; i++) {
  //   wavesurfer.drawer.fillRect(tempoData.beats[i], 0, 1, wavesurfer.params.height);
  //   wavesurfer.params.waveColor = wave_color;
  // }
}
