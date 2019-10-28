import React, {useState, useEffect, useRef} from 'react'
import './Codepen.css'

const Codepen = () => {

  return (
    <>
      <div className="progress pink">
        <div className="indeterminate white"></div>
      </div>
      <div className="app" style={{display: "non"}}>
        <div className="sequencer">
          <div className="steps"></div>
        </div>
        <a className="regenerate btn-floating btn-large waves-effect waves-light pink darken-2 pulse">
          <i className="material-icons">refresh</i>
        </a>
        <div className="controls">
          <div className="control">
            <a className="playpause btn-floating btn-large waves-effect waves-light blue">
              <i className="material-icons play-icon">play_arrow</i>
              <i className="material-icons pause-icon" style={{display: "none"}}>pause</i>
            </a>
          </div>
          <div className="control">
            <div className="input-field grey-text">
              <select id="pattern-length" defaultValue={16}>
                <option>4</option>
                <option>8</option>
                <option>16</option>
                <option>32</option>
              </select>
              Pattern length
            </div>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" id="tempo" min="20" max="240" value="120" step="1"/> Tempo
            </p>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" id="swing" min="0.5" max="0.7" value="0.55" step="0.05"/> Swing
            </p>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" id="temperature" className="tooltipped" min="0.5" max="2" value="1.1" step="0.1" data-tooltip="Higher temperatures will make the neural network generates wilder patterns" data-delay="500"/> Temperature
            </p>
          </div>
        </div>
      </div>
      <div className="info">
        <p className="webmidi-enabled" style={{display: "none"}}>
          Output:
          <select className="midi-output"></select>
        </p>
        <p className="webmidi-enabled" style={{display: "none"}}>
          MIDI clock output:
          <select className="midi-clock-output"></select>
        </p>
        <p className="webmidi-enabled" style={{display: "none"}}>
          MIDI clock input:
          <select className="midi-clock-input"></select>
        </p>
      </div>
    </>
  )
}

export default Codepen
