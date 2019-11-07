
class MidiIO {

  constructor(){
    this.midiInputs = []
    this.midiOutputs = []
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


}

export default MidiIO
