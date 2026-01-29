'use client';

import { useState } from 'react';
import Map from './components/Map';

export default function Home() {
  const startingAddress = '811 main street kansas city MO 64105';
  const [numDrones, setNumDrones] = useState(8);
  const [feetApart, setFeetApart] = useState(100);
  const [speed, setSpeed] = useState(5);
  const [isMoving, setIsMoving] = useState(true);
  const [direction, setDirection] = useState('N');

  return (
    <main style={{ minHeight: '100vh', padding: '2rem', backgroundColor: '#ffffff', color: '#000000' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem', color: '#000000' }}>
          Welcome to Simulation App
        </h1>
        <p style={{ textAlign: 'center', color: '#4b5563', marginBottom: '2rem' }}>
          Next.js + React + TypeScript + Tailwind CSS + ESLint + MapLibre
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Starting Address:</p>
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#000000' }}>{startingAddress}</p>
        </div>
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
              Number of Drones:
            </label>
            <select
              value={numDrones}
              onChange={(e) => setNumDrones(Number(e.target.value))}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#000000',
                cursor: 'pointer',
                minWidth: '120px'
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
              Feet Apart:
            </label>
            <input
              type="number"
              value={feetApart}
              onChange={(e) => setFeetApart(Number(e.target.value) || 100)}
              min="10"
              max="1000"
              step="10"
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#000000',
                width: '120px'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
              Speed (mph):
            </label>
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) || 5)}
              min="1"
              max="100"
              step="1"
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#000000',
                width: '100px'
              }}
            />
          </div>
          <button
            onClick={() => setIsMoving(!isMoving)}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '1rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: isMoving ? '#ef4444' : '#22c55e',
              color: '#ffffff',
              cursor: 'pointer',
              minWidth: '100px'
            }}
          >
            {isMoving ? 'Stop' : 'Start'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', textAlign: 'center' }}>
              Direction:
            </label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '4px',
              width: '120px'
            }}>
              {['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'].map((dir, idx) => (
                dir === '' ? (
                  <div key={idx} style={{ 
                    width: '36px', 
                    height: '36px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    ◯
                  </div>
                ) : (
                  <button
                    key={dir}
                    onClick={() => setDirection(dir)}
                    style={{
                      width: '36px',
                      height: '36px',
                      fontSize: '0.75rem',
                      fontWeight: direction === dir ? '700' : '500',
                      border: direction === dir ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: direction === dir ? '#3b82f6' : '#ffffff',
                      color: direction === dir ? '#ffffff' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    {dir}
                  </button>
                )
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            <span style={{ color: '#ef4444', fontWeight: '600' }}>●</span> Red marker: Address location
          </p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            <span style={{ color: '#3b82f6', fontWeight: '600' }}>●</span> Blue markers: {numDrones} drones ({feetApart}ft apart) - {isMoving ? `Moving ${direction} at ${speed} mph` : '(stopped)'}
          </p>
        </div>
        <Map address={startingAddress} numDrones={numDrones} feetApart={feetApart} speed={speed} isMoving={isMoving} direction={direction} />
      </div>
    </main>
  );
}
