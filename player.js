// const AudioContext = require('web-audio-api').AudioContext;
const fs = require('fs');
const mt = require('music-tempo');
const toArrayBuffer = require('to-arraybuffer');
var midi = null;
var lblCurrentTime = document.getElementById('lblDeck_current_ac_time');
var lblStartedAtTime = document.getElementById('lblDeck_started_at_time');
var lblStoppedAtTime = document.getElementById('lblDeck_stopped_at_time');
var lblDeckRate = document.getElementById('lblDeck_rate');
var lblBpm = document.getElementById('lblDeck_bpm');

window.addEventListener('load', function(){
  var deckA = new Deck();

  deckA.loadTrack();

}, false);


navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );


class Deck {
  constructor(){
    this.color2 = '#ABE6FE';                                                            // TODO read from JSON
    this.color1 = '#065ABC';
    this.color3 = '#FEF200';
    this.width = 32767;
    this.height = 150;
    this.volume = 1;
    this.mute = false;
    this.zoomStep = 3;
    this.playbackRate = 1;
    this.startedAtTime = 0;
    this.stopTime = 0;
    this.playbackTime = 0;
    this.timeLabel = document.getElementById('lblDeck_time');
    this.playing = false;
    this.paused =false;
    this.timeStep = 0;
    this.loaded = false;

    this.container = {
      waveform: '',
      element: 'deck-waveform',
      defined: false
    },

    this.currentTimeMark = '';
    this.audioCtx ={};
    this.audioBuffer = {};
    this.audioData = [];
    this.tempoData = {};
    this.track = {};
    this.trackSrc = 'snd/test_loop.wav';
    this.beatTimes = [];
    this.cuePoints = [0,0,0,0];
    this.audioCtx = new AudioContext();

    document.getElementById('current-time-mark').style.left = '760px';

    this.bindButtons();
    // this.loadTrack();
    // this.reDraw();
  }

  zoom(value){
    var newValue;
    if(value == '+'){
      newValue = this.width * this.zoomStep;
      if(newValue < 32767) {                                                    // 32767px max. canvas size
        this.width = newValue;
        this.drawWaveform();
      } else {
        this.width = 32767;
        this.drawWaveform();
      }
    }
    if(value == '-'){//&& this.width > 1500){
      newValue = this.width / this.zoomStep;
      if(newValue > 800) {
        this.width = newValue;
        this.drawWaveform();
      }
    }
    if(value == '0'){
      this.width = 32767;
      this.drawWaveform();
    }
    this.setTimeStep();
  }

  loadTrack(){
    var _deck = this;
    this.arrayBuffer = toArrayBuffer(fs.readFileSync(this.trackSrc));
    this.audioCtx.decodeAudioData(this.arrayBuffer, function(buffer){
      _deck.audioBuffer = buffer;
      _deck.processAudioData();
    });
    this.loaded = true;
  }

  connect(){
    this.track = this.audioCtx.createBufferSource();
    this.track.buffer = this.audioBuffer;
    this.track.connect(this.audioCtx.destination);
  }

  play(){
    if(this.loaded && !this.playing){
      this.connect();
      this.track.start(0, this.stopTime / 1000);
      this.startedAtTime = this.audioCtx.currentTime;
      this.reDraw();
      this.playing = true;
      this.paused = false;
    }
  }

  pause(){
    if(this.playing){
      this.track.stop();
      // this.track.disconnect();
      this.stopTime = this.playbackTime;
      this.playing = false;
      this.paused = true;
    }
  }

  stop(){
    if(this.playing){
      this.track.stop();
      // this.track.disconnect();
      this.stopTime = 0;
      this.playing = false;
      this.reDraw();
    }
  }

  displayPlaybackTime(){
    this.timeLabel.textContent = this.playbackTime;
  }

  setTimeStep(){
    this.timeStep = this.width / (this.audioBuffer.duration * 1000);
  }

  setCuePoint(cuePoint){
    cuePoint--;
    if(this.cuePoints[cuePoint] == 0){
      this.cuePoints[cuePoint] = this.playbackTime;
      this.drawCuePoint(cuePoint);
    }
  }

  delCuePoint(cuePoint){
    cuePoint--;
    var ctx = this.waveform.getContext("2d");
    ctx.clearRect(0, 0, ctx.width, ctx.height);
    this.cuePoints[cuePoint] = 0;
    this.drawWaveform();
  }

  drawCuePoint(cuePoint){
    if(this.cuePoints[cuePoint] != 0){
      var ctx = this.waveform.getContext("2d");
      var x = this.timeStep * this.cuePoints[cuePoint];
      ctx.font = "20px Arial";                                                   // TODO read from JSON file
      ctx.strokeStyle = this.color3;
      ctx.fillStyle = this.color3;
      ctx.fillText(++cuePoint, x - 15, 25);
      ctx.strokeRect(x, 0, 1, this.height);
    }
  }

  drawWaveform(){
    if(!this.container.defined){
      this.container = document.getElementById(this.container.element);
      this.waveform = document.createElement("canvas");
      this.container.appendChild(this.waveform);
      this.container.defined = true;
      this.waveform.width = this.width;
      this.waveform.height = this.height;
      this.waveform.style.width = this.width + "px";
      this.waveform.style.height = this.height + "px";
      this.waveform.style.position = 'absolute';
      this.currentTimeMark = document.getElementById('current-time-mark');
      this.waveform.style.left = this.currentTimeMark.style.left;
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

    ctx.clearRect(0, 0, this.width, this.height)

    for (var i = 0; i < this.audioData.length; i++){

      if (i == drawIdx) {

        var p1 = maxNegative * halfHeight + halfHeight;
        ctx.strokeStyle = this.color1;
        ctx.strokeRect(x, p1, 1, (maxPositive * halfHeight + halfHeight) - p1);

        var p2 = sumNegative / kNegative * halfHeight + halfHeight;
        ctx.strokeStyle = this.color2;
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
  }

  bindButtons(){
    var _deck = this;
    document.getElementById('btn_deck_play').addEventListener('click', function(){
      _deck.play();
    });
    document.getElementById('btn_deck_stop').addEventListener('click', function(){
      _deck.stop();
    });
    document.getElementById('btn_deck_pause').addEventListener('click', function(){
      _deck.pause();
    });
    document.getElementById('btn_deck_tempo_inc').addEventListener('click', function(){
      _deck.playbackRate += 0.01;
      _deck.track.playbackRate.value = _deck.playbackRate;
    });
    document.getElementById('btn_deck_tempo_dec').addEventListener('click', function(){
      _deck.playbackRate -= 0.01;
      _deck.track.playbackRate.value = _deck.playbackRate;
    });
    document.getElementById('btn_deck_zoom_inc').addEventListener('click', function(){
      _deck.zoom('+');
    });
    document.getElementById('btn_deck_zoom_dec').addEventListener('click', function(){
      _deck.zoom('-');
    });
    document.getElementById('btn_deck_zoom_res').addEventListener('click', function(){
      _deck.zoom('0');
    });
    document.getElementById('btn_deck_set_cue_point_1').addEventListener('click', function(){
      _deck.setCuePoint(1);
    });
    document.getElementById('btn_deck_set_cue_point_2').addEventListener('click', function(){
      _deck.setCuePoint(2);
    });
    document.getElementById('btn_deck_set_cue_point_3').addEventListener('click', function(){
      _deck.setCuePoint(3);
    });
    document.getElementById('btn_deck_set_cue_point_4').addEventListener('click', function(){
      _deck.setCuePoint(4);
    });
    document.getElementById('btn_deck_del_cue_point_1').addEventListener('click', function(){
      _deck.delCuePoint(1);
    });
    document.getElementById('btn_deck_del_cue_point_2').addEventListener('click', function(){
      _deck.delCuePoint(2);
    });
    document.getElementById('btn_deck_del_cue_point_3').addEventListener('click', function(){
      _deck.delCuePoint(3);
    });
    document.getElementById('btn_deck_del_cue_point_4').addEventListener('click', function(){
      _deck.delCuePoint(4);
    });

  }

  processAudioData() {
    console.time('Audio-data');

    if (this.audioBuffer.numberOfChannels > 1) {

      var channel1Data = this.audioBuffer.getChannelData(0);
      var channel2Data = this.audioBuffer.getChannelData(1);

      var length = channel1Data.length;

      for (var i = 0; i < length; i++) {
        this.audioData[i] = (channel1Data[i] + channel2Data[i]) / 2;
      }

    } else {
      this.audioData = this.audioBuffer.getChannelData(0);
    }

    this.tempoData = new mt(this.audioData);

    for (var i = 0; i < this.tempoData.beats.length; i++) {
      this.beatTimes[i] = Math.round(this.audioBuffer.sampleRate * this.tempoData.beats[i]);
    }

    document.getElementById('lblDeck_bpm').textContent = this.tempoData.tempo;
    console.timeEnd('Audio-data');

    this.setTimeStep();
    this.drawWaveform();
  }

  reDraw(timestamp){

    if(this.playing){

      this.playbackTime = parseInt(((this.audioCtx.currentTime - this.startedAtTime) + (this.stopTime / 1000)) * 1000);
      this.waveform.style.left = parseInt(this.currentTimeMark.style.left) - ((this.timeStep * this.playbackTime) * this.playbackRate ) + 'px';

      if(this.playbackTime > (this.audioBuffer.duration * 1000)){
        // this.stop();
      }
    }

    this.displayPlaybackTime();

    lblCurrentTime.textContent = this.audioCtx.currentTime;
    lblStartedAtTime.textContent = this.startedAtTime;
    lblStoppedAtTime.textContent = this.stopTime;
    lblDeckRate.textContent = this.playbackRate;

    window.requestAnimationFrame(this.reDraw.bind(this));
  }
}



function onMIDISuccess(midiAccess) {
  console.log( "MIDI ready!" );
  midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
}

function onMIDIFailure(msg) {
  console.log( "Failed to get MIDI access - " + msg );
}
