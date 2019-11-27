import {GUI} from 'dat.gui'


const gui = new GUI({autoPlace: false})
let input = null
let output = null

//nasty hack to dat.gui
function blurMe(){
  if(this.__checkbox)
    this.__checkbox.blur()
  else if(this.__select)
    this.__select.blur()
}

export const setupGUI = (guiEl, options, monoBass,DrumKit, changeClickActive, setClickVolume, setTempo) =>{
  //save and recall settings from localstorage
  gui.useLocalStorage = true
  gui.remember(options)
  //fucking no typed shit
  options.subdivisions = parseInt(options.subdivisions)

  guiEl.appendChild(gui.domElement)

  // gui.add(options, 'useSynth').name('Use Synth').onChange(monoBass.setActive).onFinishChange(blurMe)
  // gui.add(options, 'synthVolume', -60, 0).name('Synth Vol.').onChange(monoBass.setVolume)
  // gui.add(options, 'playClick').name('Play Click').onChange(changeClickActive).onFinishChange(blurMe)
  // gui.add(options, 'clickVolume', -60, 0).name('Click Vol.').onChange(setClickVolume)
  // gui.add(options, 'drumsVolume', -60, 0).name('Drums Vol.').onChange(DrumKit.setVolume)
  gui.add(options, 'temperature', 0.0, 2.0).name('Temperature').listen()
  gui.add(options, 'qpm', 70, 130).name('Tempo').step(1).onChange(setTempo).listen()
  gui.add(options, 'subdivisions', [4,8,16]).name('Subdivisions').onChange((v)=>{
    //fucking no typed shit
    options.subdivisions = parseInt(v)
  }).onFinishChange(blurMe).listen()
  gui.add(options, 'interpolation', 1, 16).name('Interpolation').step(1).listen()
  gui.add(options, 'reactiveness', 0.0, 1.0).name('Reactiveness').listen()
  gui.add(options, 'quantize').name('Quantize').listen()



  input = gui.add(options, 'input',[])
  output = gui.add(options, 'output',[])


  //set remembered values
  monoBass.setActive(options.useSynth)
  monoBass.setVolume(options.synthVolume)
  changeClickActive(options.playClick)
  setClickVolume(options.clickVolume)
  DrumKit.setVolume(options.drumsVolume)
  setTempo(options.qpm)

}

//nasty hack to dat.gui
let ignoreChange = false
function changeMe(v){
  ignoreChange = true
}

/*midi devices changed handler*/
export const onMidiDevicesChanged = (m) =>{
  if(ignoreChange ){
    ignoreChange = false
    return
  }
  // unfortunatelly, dat.gui has no means of
  // updating controller options without recreating it
  // so, onchange handler has to be bound here
  const inputs = { 'All Midi Inputs': 'all',  'Computer Keyboard': 'keyboard'}
  m.midiInputs.forEach(i => inputs[i.name] = i.id)
  input = input.options(inputs).name('Input').onChange(changeMe).onFinishChange(blurMe).listen()

  const outputs = { 'No Output': 'none','WebAudio Drum': 'webaudio'}
  m.midiOutputs.forEach(i => outputs[i.name] = i.id)
  output = output.options(outputs).name('Output').onChange(changeMe).onFinishChange(blurMe).listen()

}
