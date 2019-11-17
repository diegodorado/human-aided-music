import AudioKeys from 'audiokeys'

const keyboard = new AudioKeys({polyphony: 1,rows: 1, rootNote: 48})

export const setupKeyboard = (options,recorder,monoBass) =>{
  keyboard.down( (note) => {
    if (options.input === 'keyboard'){
      const data = { pitch: note.note, velocity:100}
      recorder.noteOn(data)
      monoBass.noteOn(data)
    }
  })
  keyboard.up( (note) => {
    if (options.input === 'keyboard'){
      const data = { pitch: note.note, velocity:0}
      recorder.noteOff(data)
      monoBass.noteOff(data)
    }
  })
}
