import Reactor from './Reactor'

const reactor = new Reactor()

class MidiIO {

  constructor(){
    this.midiInputs = []
    this.midiOutputs = []
    reactor.registerEvent('note_on')
    reactor.registerEvent('note_off')
  }

  async initialize() {
    // Start up WebMidi.
    await (navigator)
        .requestMIDIAccess()
        .then(
            (midi) => this.midiReady(midi),
            (err) => console.log('Something went wrong', err))
  }

  midiReady(midi) {
    console.log('Initialized MidiIO');
    const inputs = midi.inputs.values()
    for (let i = inputs.next(); i && !i.done;i = inputs.next())
      this.midiInputs.push(i.value)

    const outputs = midi.outputs.values()
    for (let o = outputs.next(); o && !o.done;o = outputs.next())
      this.midiOutputs.push(o.value)

  }

  connectAllInputs() {
    // Start listening to MIDI messages.
    for (const input of this.midiInputs) {
      input.onmidimessage = (event) => {
        this.midiMessageReceived(event)
      }
    }
  }


  midiMessageReceived(event) {
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

    // MIDI commands we care about. See
    const NOTE_ON = 9
    const NOTE_OFF = 8

    const cmd = event.data[0] >> 4;
    const pitch = event.data[1];
    const velocity = (event.data.length > 2) ? event.data[2] : 1;
    const device = event.srcElement;

    // Some MIDI controllers don't send a separate NOTE_OFF command.
    if (cmd === NOTE_OFF || (cmd === NOTE_ON && velocity === 0)) {
      reactor.dispatchEvent('note_off',{pitch, velocity, timeStamp})
    } else if (cmd === NOTE_ON) {
      reactor.dispatchEvent('note_on',{pitch, velocity, timeStamp})
    }
  }

  onNoteOn = (callback) =>{
    reactor.addEventListener('note_on', callback)
  }

  onNoteOff = (callback) =>{
    reactor.addEventListener('note_off', callback)
  }


}

export default MidiIO
