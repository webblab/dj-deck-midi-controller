// const AudioContext = require('web-audio-api').AudioContext;
const fs = require('fs');
const mt = require('music-tempo');
const toArrayBuffer = require('to-arraybuffer');
var midi = null;

var lblPlaybackRate   = document.getElementById('lbl_deck_playback_rate');
var lblStartedAtTime  = document.getElementById('lbl_deck_started_at_time');
var lblStoppedAtTime  = document.getElementById('lbl_deck_stopped_at_time');
var lblCurrentTime    = document.getElementById('lbl_deck_current_ac_time');
var lblDeckWidth      = document.getElementById('lbl_deck_width');
var lblTimeStep       = document.getElementById('lbl_deck_time_step');
var lblBPM            = document.getElementById('lbl_deck_bpm');

window.addEventListener('load', function(){
  var deckA = new Deck();
  deckA.loadTrack();
}, false);


navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );


class Deck {
  constructor(){
    this.color2 = '#ABE6FE'; // WaveForm                                                           // TODO read from JSON
    this.color1 = '#065ABC'; // WaveForm
    this.color3 = '#FEF200'; // Cue Points
    this.color4 = '#EA5758'; // Beat lines
    this.cuePointFont = '12px Arial';
    this.width = 800;
    this.height = 150;
    this.volume = 1;
    this.mute = false;
    this.playbackRate = 1;
    this.startedAtTime = 0;
    this.stopTime = 0;
    this.playbackTime = 0;
    this.timeLabel = document.getElementById('lbl_deck_time');
    this.playing = false;
    this.paused = false;
    this.cuePlay = false;
    this.timeStep = 3;
    this.loaded = false;
    this.audioCtx ={};
    this.audioBuffer = {};
    this.audioData = [];
    this.tempoData = {};
    this.trackSrc = 'snd/Stanton Warriors - Club Action (Stanton Warriors Remix).mp3';
    this.beatTimes = [];
    this.cuePoints = [-1,-1,-1,-1];
    this.audioCtx = new AudioContext();
    // Deck waveform container
    this.container = document.getElementById('deck-waveform');
    this.canvases = [0];
    this.currentTimeMark = document.getElementById('current-time-mark');
    document.getElementById('current-time-mark').style.left = '0px';

    this.createCanvas();
    this.bindButtons();
    this.program_loop();
  }

  zoom(value){
    // var _width = this.width;
    if(value == '+'){
      this.width = this.width + 1000;
      if(this.width > 32767) {                                                    // 32767px max. canvas size
        this.width = 32767;
      }
    }
    if(value == '-'){
      this.width = this.width - 1000;
      if(this.width < 800) {
        this.width = 800;
      }
    }
    if(value == '0'){
      this.width = 32767;
    }
    // if(_width != this.width){
      this.waveform.width = this.width;
      this.waveform.style.width = this.width + "px";
      this.setTimeStep();
    // }
  }

  loadTrack(){
    var _deck = this;
    this.arrayBuffer = toArrayBuffer(fs.readFileSync(this.trackSrc));
    this.audioCtx.decodeAudioData(this.arrayBuffer, function(buffer){
      _deck.audioBuffer = buffer;
      _deck.processAudioData();
    });
  }

  connect(){
    this.track = this.audioCtx.createBufferSource();
    this.track.buffer = this.audioBuffer;
    this.track.connect(this.audioCtx.destination);
    this.loaded = true;
  }

  play(playAt = this.stopTime){
    if(this.loaded && !this.playing){
      this.connect();
      this.track.playbackRate.value = this.playbackRate;
      this.track.start(0, playAt);
      this.startedAtTime = this.audioCtx.currentTime;
      this.playing = true;
      this.paused = false;
    }
  }

  pause(stopTime = this.playbackTime){
    if(this.playing){
      this.stop(stopTime);
      this.paused = true;
    }
  }

  stop(stopTime = 0){
    this.track.stop();
    this.track.disconnect();
    this.playbackTime = stopTime;
    this.stopTime = stopTime;
    this.playing = false;
  }

  displayValues(){
    lblBPM.textContent            = this.tempoData.tempo;
    this.timeLabel.textContent    = this.playbackTime;
    lblCurrentTime.textContent    = this.audioCtx.currentTime;
    lblStartedAtTime.textContent  = this.startedAtTime;
    lblStoppedAtTime.textContent  = this.stopTime;
    lblDeckWidth.textContent      = this.width;
    lblPlaybackRate.textContent   = this.playbackRate;
    lblTimeStep.textContent       = this.timeStep;
  }

  setTimeStep(){
    this.timeStep = this.width / (this.audioBuffer.duration * 1000);
    // this.timeStep = 0.1;
    this.drawWaveform();
  }

  cuePoint(cuePoint, mouse){
    cuePoint--;

    if(mouse == 'up' && this.cuePoints[cuePoint] == -1){
      this.cuePoints[cuePoint] = this.playbackTime;
      this.drawCuePoint(cuePoint);
    }

    if(mouse == 'down' && this.cuePoints[cuePoint] != -1 && !this.paused){
      this.stop(this.cuePoints[cuePoint]);
      this.play(this.cuePoints[cuePoint]);
    }

    if(mouse == 'down' && this.cuePoints[cuePoint] != -1 && this.paused){
      this.stop(this.cuePoints[cuePoint]);
      this.play(this.cuePoints[cuePoint]);
      this.cuePlay = true;
    }

    if(mouse == 'up' && this.cuePoints[cuePoint] != -1 && this.cuePlay){
      this.pause(this.cuePoints[cuePoint]);
      this.cuePlay = false;
    }
  }

  delCuePoint(cuePoint){
    cuePoint--;
    var ctx = this.waveform.getContext("2d");
    ctx.clearRect(0, 0, ctx.width, ctx.height);
    this.cuePoints[cuePoint] = -1;
    this.drawWaveform();
  }

  createCanvas(){
    this.waveform = document.createElement("canvas");
    this.container.appendChild(this.waveform);
    this.waveform.width = this.width;
    this.waveform.height = this.height;
    this.waveform.style.width = this.width + "px";
    this.waveform.style.height = this.height + "px";
    this.waveform.style.position = 'absolute';
    this.waveform.style.left = this.currentTimeMark.style.left;
    this.container.style.overflow = 'hidden';
    // this.waveform.style.overflow = 'auto';
    this.waveform.style.position = 'relative';
  }

  drawWaveform(){
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

    ctx.clearRect(0, 0, 32767, this.height)

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
    // this.drawBeatLines(ctx);
    // this.drawCuePoints(ctx);
  }

  drawBeatLines(){
    var ctx = this.waveform.getContext("2d");
    var step = Math.round(this.audioData.length / this.width);
    for (var i = 0; i < this.tempoData.beats.length; i++) {
      ctx.strokeStyle = this.color4;
      ctx.strokeRect(Math.round(this.beatTimes[i] / step), 0, 1, 30);
      ctx.strokeRect(Math.round(this.beatTimes[i] / step), this.height - 30, 1, 30);
      // Draw number to Beat line
      ctx.font = this.cuePointFont;
      ctx.fillStyle = this.color4;
      ctx.fillText(i, Math.round(this.beatTimes[i] / step) + 5, 12);
    }
  }

  drawCuePoints(){
    var ctx = this.waveform.getContext("2d");
    for(var cuePoint = 0; cuePoint < this.cuePoints.length; cuePoint++){
      this.drawCuePoint(cuePoint);
    }
  }

  drawCuePoint(cuePoint){
    if(this.cuePoints[cuePoint] != -1){
      var ctx = this.waveform.getContext("2d");
      var x = this.timeStep * this.cuePoints[cuePoint];
      ctx.font = this.cuePointFont;                                                   // TODO read from JSON file
      ctx.strokeStyle = this.color3;
      ctx.fillStyle = this.color3;
      ctx.fillText(++cuePoint, x - 15, this.height - 5);
      ctx.strokeRect(x, 0, 1, this.height);
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
      _deck.playbackRate += 0.1;
      _deck.track.playbackRate.value = _deck.playbackRate;
    });
    document.getElementById('btn_deck_tempo_dec').addEventListener('click', function(){
      _deck.playbackRate -= 0.1;
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
    document.getElementById('btn_deck_set_cue_point_1').addEventListener('mouseup', function(){
      _deck.cuePoint(1, 'up');
    });
    document.getElementById('btn_deck_set_cue_point_1').addEventListener('mousedown', function(){
      _deck.cuePoint(1, 'down');
    });
    document.getElementById('btn_deck_set_cue_point_2').addEventListener('mouseup', function(){
      _deck.cuePoint(2, 'up');
    });
    document.getElementById('btn_deck_set_cue_point_2').addEventListener('mousedown', function(){
      _deck.cuePoint(2, 'down');
    });
    document.getElementById('btn_deck_set_cue_point_3').addEventListener('mouseup', function(){
      _deck.cuePoint(3, 'up');
    });
    document.getElementById('btn_deck_set_cue_point_3').addEventListener('mousedown', function(){
      _deck.cuePoint(3, 'down');
    });
    document.getElementById('btn_deck_set_cue_point_4').addEventListener('mouseup', function(){
      _deck.cuePoint(4, 'up');
    });
    document.getElementById('btn_deck_set_cue_point_4').addEventListener('mousedown', function(){
      _deck.cuePoint(4, 'down');
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
    document.getElementById('zoom-slider').addEventListener('change', function(){
      _deck.width = document.getElementById('zoom-slider').value;
      _deck.zoom();
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

    this.setTimeStep();
    this.connect();
  }

  program_loop(timestamp){
    if(this.playing){
      this.playbackTime = (((this.audioCtx.currentTime - this.startedAtTime) + this.stopTime) * this.playbackRate);
    }
    if(this.playbackTime > (this.audioBuffer.duration)){
      this.stop();
      this.play();
    }
    this.shiftWaveform();
    this.displayValues();

    window.requestAnimationFrame(this.program_loop.bind(this));
  }

  shiftWaveform(){
    this.waveform.style.left = (this.playbackTime * this.timeStep * -1000) + 'px';
  }
}


function onMIDISuccess(midiAccess) {
  console.log( "MIDI ready!" );
  midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
}

function onMIDIFailure(msg) {
  console.log( "Failed to get MIDI access - " + msg );
}
