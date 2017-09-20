// const AudioContext = require('web-audio-api').AudioContext;
const fs = require('fs');
const mt = require('music-tempo');
const toArrayBuffer = require('to-arraybuffer');
var midi = null;

window.addEventListener('load', function(){
  init();
  Deck.loadTrack();
  cycle();
}, false);


navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );

var lblBpm = document.getElementById('lblDeck_bpm');

var Deck = {
  color1: '#065ABC',
  color2: '#ABE6FE',
  color3: '#FEF200',
  width: 32767,
  height: 150,
  volume: 1,
  mute: false,
  zoom: 0,
  zoomStep: 3,
  playbackRate: 1,
  startTime: 0,
  stopTime: 0,
  playbackTime: 0,
  timeLabel: document.getElementById('lblDeck_time'),
  playing: false,
  timeStep: 0,

  container: {
    waveform: '',
    element: 'deck-waveform',
    defined: false
  },

  currentTimeMark: '',
  audioCtx:{},
  audioBuffer: {},
  audioData: [],
  tempoData: {},
  track: {
    playbackRate: 1,
  },
  trackSrc: 'snd/test_loop.wav',
  beatTimes: [],
  cuePoints: [0,0,0,0],

  zoom: function(value){
    var newValue;
    if(value == '+'){
      newValue = this.width * this.zoomStep;
      if(newValue < 32767) {                                                    // 32767px max. canvas size
        this.width = newValue;
      }
    }
    if(value == '-'){//&& this.width > 1500){
      newValue = this.width / this.zoomStep;
      if(newValue > 800) {
        this.width = newValue;
      }
    }
    if(value == '0'){
      this.width = 32767;
    }
    this.setTimeStep();
    this.drawWaveform();
  },

  loadTrack: function(){
    console.time('Load-Track');
    this.audioCtx = new AudioContext();
    this.audioCtx.decodeAudioData(
      toArrayBuffer(fs.readFileSync(Deck.trackSrc)),
      processAudioData
    );
    console.timeEnd('Load-Track');
  },

  play: function(){
    if(!this.playing){
      this.track = this.audioCtx.createBufferSource();
      this.track.buffer = this.audioBuffer;
      this.track.playbackRate = this.playbackRate;
      this.track.connect(this.audioCtx.destination);
      this.track.start(0, this.stopTime / 1000);
      this.startTime = this.audioCtx.currentTime;
      this.playing = true;
    }
  },

  pause: function(){
    this.track.stop();
    this.track.disconnect();
    this.stopTime = this.playbackTime;
    this.playing = false;
  },

  stop: function(){
    this.track.stop();
    this.track.disconnect();
    this.stopTime = 0;
    this.playing = false;
  },

  displayPlaybackTime: function(){
    this.timeLabel.textContent = this.playbackTime / 1000;
  },

  setTimeStep: function(){
    this.timeStep = this.width / (this.audioBuffer.duration * 1000);
  },

  setCuePoint: function(cuePoint){
    cuePoint--;
    this.cuePoints[cuePoint] = this.playbackTime;
    this.drawCuePoint(cuePoint);
  },

  delCuePoint: function(cuePoint){
    cuePoint--;
    var ctx = this.waveform.getContext("2d");
    ctx.clearRect(0, 0, ctx.width, ctx.height);
    this.cuePoints[cuePoint] = 0;
    this.drawWaveform();
  },

  drawCuePoint: function(cuePoint){

    if(this.cuePoints[cuePoint] != 0){

      var ctx = this.waveform.getContext("2d");
      var x = this.timeStep * this.cuePoints[cuePoint];
      ctx.font = "20px Arial";
      ctx.strokeStyle = this.color3;
      ctx.fillStyle = this.color3;
      ctx.fillText(++cuePoint, x - 15, 25);
      ctx.strokeRect(x, 0, 1, this.height);
    }
  },

  drawWaveform: function() {
    console.time('Draw-waveform');

    if(!this.container.defined)
    {
      this.container = document.getElementById(Deck.container.element);
      this.waveform = document.createElement("canvas");
      this.container.appendChild(Deck.waveform);
      this.container.defined = true;
      this.waveform.width = Deck.width;
      this.waveform.height = Deck.height;
      this.waveform.style.width = Deck.width + "px";
      this.waveform.style.height = Deck.height + "px";
      this.waveform.style.position = 'absolute';
      this.currentTimeMark = document.getElementById('current-time-mark');
      this.waveform.style.left = Deck.currentTimeMark.style.left;
    }

    var ctx = this.waveform.getContext("2d");
    var halfHeight = this.height / 2;
    var step = Math.round(this.audioData.length / this.width);
    var x = 0;
    var sumPositive = 0;
    var sumNegative = 0;
    var maxPositive = 0;
    var maxNegative = 0;
    var kNegative = 0;
    var kPositive = 0;
    var drawIdx = step;

    for (var i = 0; i < this.audioData.length; i++) {
      if (i == drawIdx) {

        var p1 = maxNegative * halfHeight + halfHeight;
        ctx.strokeStyle = Deck.color1;
        ctx.strokeRect(x, p1, 1, (maxPositive * halfHeight + halfHeight) - p1);

        var p2 = sumNegative / kNegative * halfHeight + halfHeight;
        ctx.strokeStyle = Deck.color2;
        ctx.strokeRect(x, p2, 1, (sumPositive / kPositive * halfHeight + halfHeight) - p2);

        x++;
        drawIdx += step;
        sumPositive = 0;
        sumNegative = 0;
        maxPositive = 0;
        maxNegative = 0;
        kNegative = 0;
        kPositive = 0;
      } else {
        if (this.audioData[i] < 0) {
          sumNegative += this.audioData[i];
          kNegative++;
          if (maxNegative > this.audioData[i]) maxNegative = this.audioData[i];
        } else {
          sumPositive += this.audioData[i];
          kPositive++;
          if (maxPositive < this.audioData[i]) maxPositive = this.audioData[i];
        }
      }
    }

    for (var i = 0; i < this.tempoData.beats.length; i++) {
      ctx.strokeStyle = '#EA5758';
      ctx.strokeRect(Math.round(this.beatTimes[i] / step), 0, 1, this.height);
    }

    for(var cuePoint = 0; cuePoint < this.cuePoints.length; cuePoint++){
      this.drawCuePoint(cuePoint);
    }

    Deck.waveform.style.left = parseInt(Deck.currentTimeMark.style.left) - ((Deck.timeStep * Deck.playbackTime) * Deck.track.playbackRate.value ) + 'px';
    console.timeEnd('Draw-waveform');
  }
}

function init(){

  document.getElementById('btnDeck_play').addEventListener('click', function(){
    Deck.play();
  });

  document.getElementById('btnDeck_stop').addEventListener('click', function(){
    Deck.stop();
  });

  document.getElementById('btnDeck_pause').addEventListener('click', function(){
    Deck.pause();
  });

  document.getElementById('btnDeck_tempoInc').addEventListener('click', function(){
    Deck.playbackRate += 0.01;
    Deck.track.playbackRate.value = Deck.playbackRate;
  });

  document.getElementById('btnDeck_tempoDec').addEventListener('click', function(){
    Deck.playbackRate -= 0.01;
    Deck.track.playbackRate.value = Deck.playbackRate;
  });

  document.getElementById('btnDeck_zoomInc').addEventListener('click', function(){
    Deck.zoom('+');
  });

  document.getElementById('btnDeck_zoomDec').addEventListener('click', function(){
    Deck.zoom('-');
  });

  btnDeck_zoomRes.addEventListener('click', function(){
    Deck.zoom('0');
  });

  document.getElementById('current-time-mark').style.left = '760px';

  document.getElementById('btnDeck_cue_point_1').addEventListener('click', function (){
    Deck.setCuePoint(1);
  });
  document.getElementById('btnDeck_cue_point_2').addEventListener('click', function (){
    Deck.setCuePoint(2);
  });
  document.getElementById('btnDeck_cue_point_3').addEventListener('click', function (){
    Deck.setCuePoint(3);
  });
  document.getElementById('btnDeck_cue_point_4').addEventListener('click', function (){
    Deck.setCuePoint(4);
  });
  document.getElementById('btnDeck_cue_point_1_del').addEventListener('click', function (){
    Deck.delCuePoint(1);
  });
  document.getElementById('btnDeck_cue_point_2_del').addEventListener('click', function (){
    Deck.delCuePoint(2);
  });
  document.getElementById('btnDeck_cue_point_3_del').addEventListener('click', function (){
    Deck.delCuePoint(3);
  });
  document.getElementById('btnDeck_cue_point_4_del').addEventListener('click', function (){
    Deck.delCuePoint(4);
  });
}

function processAudioData(buffer) {
  console.time('Audio-data');

  Deck.audioBuffer = buffer;
  Deck.sampleRate = buffer.sampleRate;

  if (buffer.numberOfChannels > 1) {

    var channel1Data = buffer.getChannelData(0);
    var channel2Data = buffer.getChannelData(1);

    var length = channel1Data.length;

    for (var i = 0; i < length; i++) {
      Deck.audioData[i] = (channel1Data[i] + channel2Data[i]) / 2;
    }

  } else {
    Deck.audioData = buffer.getChannelData(0);
  }

  Deck.tempoData = new mt(Deck.audioData);

  for (var i = 0; i < Deck.tempoData.beats.length; i++) {
    Deck.beatTimes[i] = Math.round(Deck.sampleRate * Deck.tempoData.beats[i]);
  }

  document.getElementById('lblDeck_bpm').textContent = Deck.tempoData.tempo;
  console.timeEnd('Audio-data');

  Deck.setTimeStep();
  Deck.drawWaveform();
}

function cycle(timestamp){

  if(Deck.playing){

    Deck.playbackTime = parseInt((Deck.audioCtx.currentTime - Deck.startTime) * 1000);
    Deck.waveform.style.left = parseInt(Deck.currentTimeMark.style.left) - ((Deck.timeStep * Deck.playbackTime) * Deck.track.playbackRate.value ) + 'px';

    if(Deck.playbackTime > (Deck.audioBuffer.duration * 1000)){
      // Deck.stop();
    }
  }

  Deck.displayPlaybackTime();
  window.requestAnimationFrame(cycle);
}

function onMIDISuccess(midiAccess) {
  console.log( "MIDI ready!" );
  midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
}

function onMIDIFailure(msg) {
  console.log( "Failed to get MIDI access - " + msg );
}
