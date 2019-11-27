import Reactor from './Reactor'

const reactor = new Reactor()

// MIDI commands we care about. (discarding channel)
const NOTE_ON = 0x90
const NOTE_OFF = 0x80
const CC = 0xB0

const CLOCK = 0xF8
const START =  0xFA
const CONTINUE = 0xFB
const STOP = 0xFC


class MidiIO {
  autoconnectInputs = false

  constructor(){
    this.midiInputs = []
    this.midiOutputs = []
    reactor.registerEvent('note_on')
    reactor.registerEvent('note_off')
    reactor.registerEvent('devices_changed')
    reactor.registerEvent('start')
    reactor.registerEvent('continue')
    reactor.registerEvent('stop')
    reactor.registerEvent('clock')
    reactor.registerEvent('control_change')
  }

  async initialize({autoconnectInputs = false}) {
    this.autoconnectInputs = autoconnectInputs
    // Start up WebMidi.
    await (navigator)
        .requestMIDIAccess()
        .then(
            (midi) => this.midiReady(midi),
            (err) => console.log('Something went wrong', err))
  }

  onStateChange = (ev) =>{
    const midi = ev.target

    const changed = (a,b) => a.length === b.length
                    && a.sort().every((v, i) => v === b.sort()[i])

    const i0 = this.midiInputs.map(i => i.id)
    const o0 = this.midiOutputs.map(i => i.id)
    this.refreshDevices(midi)
    const i1 = this.midiInputs.map(i => i.id)
    const o1 = this.midiOutputs.map(i => i.id)


    if(changed(i0,i1) || changed(o0,o1) ){
      reactor.dispatchEvent('devices_changed',this)
      if(this.autoconnectInputs)
        this.connectAllInputs()
    }

  }


  refreshDevices = (midi) =>{
    this.midiInputs = []
    const inputs = midi.inputs.values()
    for (let i = inputs.next(); i && !i.done;i = inputs.next())
      this.midiInputs.push(i.value)

    this.midiOutputs = []
    const outputs = midi.outputs.values()
    for (let o = outputs.next(); o && !o.done;o = outputs.next())
      this.midiOutputs.push(o.value)
  }


  midiReady(midi) {
    this.refreshDevices(midi)
    midi.onstatechange = this.onStateChange
    console.log('Initialized MidiIO')
    if(this.autoconnectInputs)
      this.connectAllInputs()

  }

  connectAllInputs() {
    // Start listening to MIDI messages.
    for (const input of this.midiInputs) {
      input.onmidimessage = this.midiMessageReceived
    }
  }


  midiMessageReceived = (event) => {
    if( (event.data[0] & 0xF0) === 0xF0){

      switch (event.data[0]) {
        case START:
          reactor.dispatchEvent('start', event)
          break;
        case CONTINUE:
          reactor.dispatchEvent('continue', event)
          break;
        case STOP:
          reactor.dispatchEvent('stop', event)
          break;
        case CLOCK:
          reactor.dispatchEvent('clock', event)
          break;
        default:

      }

    }else{
      // event.timeStamp doesn't seem to work reliably across all
      // apps and controllers (sometimes it isn't set, sometimes it doesn't
      // change between notes). Use the performance now timing, unless it exists.
      let timeStampOffset;
      if (event.timeStamp !== undefined && event.timeStamp !== 0) {
        timeStampOffset = event.timeStamp;
      } else {
        timeStampOffset = performance.now();
      }
      const timeStamp = timeStampOffset + performance.timing.navigationStart


      const d = event.data
      const device = event.srcElement;

      switch (d[0] & 0xF0) {
        case NOTE_ON:
          reactor.dispatchEvent((d[1]===0)? 'note_off' : 'note_on',{pitch:d[1], velocity:d[2], timeStamp, device})
          break;
        case NOTE_OFF:
          reactor.dispatchEvent('note_off',{pitch:d[1], velocity:d[2], timeStamp, device})
          break;
        case CC:
          reactor.dispatchEvent('control_change',{cc:d[1], value:d[2], timeStamp, device})
          break;
        default:

      }
    }

  }

  onNoteOn = (callback) =>{
    reactor.addEventListener('note_on', callback)
  }

  onNoteOff = (callback) =>{
    reactor.addEventListener('note_off', callback)
  }

  onCC = (callback) =>{
    reactor.addEventListener('control_change', callback)
  }

  onDevicesChanged = (callback) =>{
    reactor.addEventListener('devices_changed', callback)
  }

  onStart = (callback) =>{
    reactor.addEventListener('start', callback)
  }
  onContinue = (callback) =>{
    reactor.addEventListener('continue', callback)
  }
  onStop = (callback) =>{
    reactor.addEventListener('stop', callback)
  }
  onClock = (callback) =>{
    reactor.addEventListener('clock', callback)
  }

  getInputById = (id) =>{
    for (let i of this.midiInputs)
      if (i.id === id) return i
  }

  getOutputById = (id) =>{
    for (let i of this.midiOutputs)
      if (i.id === id) return i
  }




}

export default MidiIO
