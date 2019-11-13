import Reactor from './Reactor'

const reactor = new Reactor()

// MIDI commands we care about. See
const NOTE_ON = 9
const NOTE_OFF = 8

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
      const timeStamp = timeStampOffset + performance.timing.navigationStart;


      const cmd = event.data[0] >> 4;
      const pitch = event.data[1];
      const velocity = (event.data.length > 2) ? event.data[2] : 1;
      const device = event.srcElement;

      // Some MIDI controllers don't send a separate NOTE_OFF command.
      if (cmd === NOTE_OFF || (cmd === NOTE_ON && velocity === 0)) {
        reactor.dispatchEvent('note_off',{pitch, velocity, timeStamp, device})
      } else if (cmd === NOTE_ON) {
        reactor.dispatchEvent('note_on',{pitch, velocity, timeStamp, device})
      }
    }




  }

  onNoteOn = (callback) =>{
    reactor.addEventListener('note_on', callback)
  }

  onNoteOff = (callback) =>{
    reactor.addEventListener('note_off', callback)
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


  sendNote = (device, note, time,duration) =>{
    //device.send([0x90, note.pitch,note.velocity],time)
    //device.send([0x80, note.pitch,note.velocity],time)
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
