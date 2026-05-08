import { useState } from 'react'
import './AddTickerForm.css'

export default function AddTickerForm({ onAdd }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const ticker = value.trim().toUpperCase()
    if (!ticker) return
    onAdd(ticker)
    setValue('')
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input
        className="add-input"
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Enter ticker (e.g. AAPL)"
        maxLength={10}
        spellCheck={false}
        autoComplete="off"
      />
      <button className="add-btn" type="submit">Add</button>
    </form>
  )
}
