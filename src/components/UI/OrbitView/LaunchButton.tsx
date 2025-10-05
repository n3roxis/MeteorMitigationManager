import React, { useEffect, useRef, useState } from 'react';
import { Projectile } from '../../../solar_system/entities/Projectile';
import { registerEntity } from '../../../solar_system/state/entities';
import { Vector } from '../../../solar_system/utils/Vector';
import { EARTH_MOON_BARYCENTER } from '../../../solar_system/data/bodies';
import { SIM_TIME_DAYS } from '../../../solar_system/state/simulation';
import { orbitalPositionAtTime } from '../../../solar_system/utils/orbitalMath';
import { LaserWeapon } from '../../../solar_system/entities/LaserWeapon';
import { ENTITIES, registerEntity as reg } from '../../../solar_system/state/entities';

let projectileCounter = 0;

/**
 * Approximate instantaneous orbital velocity of the Earth-Moon barycenter by finite difference.
 * Uses small symmetric time offset around current SIM_TIME_DAYS.
 */
function getEarthBaryVelocityAUPerSec(): Vector {
  if (!EARTH_MOON_BARYCENTER || !EARTH_MOON_BARYCENTER.orbit) return new Vector(0,0,0);
  const o: any = EARTH_MOON_BARYCENTER.orbit;
  // Choose a small time step (seconds) for derivative; 60s is a good compromise.
  const hSec = 60;
  const tSec = SIM_TIME_DAYS * 86400;
  const phase = EARTH_MOON_BARYCENTER.orbitPhase;
  const elem = {
    semiMajorAxis: o.semiMajorAxis,
    eccentricity: o.eccentricity,
    periodDays: o.periodDays,
    inclinationDeg: o.inclinationDeg,
    longitudeAscendingNodeDeg: o.longitudeAscendingNodeDeg,
    argumentOfPeriapsisDeg: o.argumentOfPeriapsisDeg
  };
  const [x1, y1, z1] = orbitalPositionAtTime(elem, phase, tSec - hSec);
  const [x2, y2, z2] = orbitalPositionAtTime(elem, phase, tSec + hSec);
  const vx = (x2 - x1) / (2 * hSec);
  const vy = (y2 - y1) / (2 * hSec);
  const vz = (z2 - z1) / (2 * hSec);
  return new Vector(vx, vy, vz);
}

/**
 * Launch button spawns a projectile at the Earth-Moon barycenter with a random radial direction.
 * Initial velocity = Earth barycenter orbital velocity + random radial component.
 */
export const LaunchButton: React.FC = () => {
  const laserRef = useRef<LaserWeapon | null>(null);
  const [laserOn, setLaserOn] = useState(false);

  // Attempt to find a meteor target (first entity whose id starts with 'meteor')
  const findMeteorId = () => {
    const m = ENTITIES.find(e => (e as any).id && (e as any).id.startsWith('meteor')) as any;
    return m ? m.id : null;
  };

  useEffect(() => {
    // Create laser once when a meteor is available and L1 exists
    if (!laserRef.current) {
      const meteorId = findMeteorId();
      const l1 = ENTITIES.find(e => (e as any).id === 'sun-earth-L1');
      if (meteorId && l1) {
        const laser = new LaserWeapon('laser-l1-meteor', 'sun-earth-L1', meteorId);
        laserRef.current = laser;
        reg(laser);
      }
    }
  });
  const onClick = () => {
    const origin = EARTH_MOON_BARYCENTER?.position || new Vector(0,0,0);
    const theta = Math.random() * Math.PI * 2; // random heading in plane
    const dir = new Vector(Math.cos(theta), Math.sin(theta), 0);
    // Random speed component (1 to 7 km/s) converted to AU/sec
    const kmPerSec = 1 + Math.random() * 6;
    const AU_PER_KM = 1 / 149597870.7; // AU per km
    const relSpeedAUPerSec = kmPerSec * AU_PER_KM;
    const randomVel = dir.scale(relSpeedAUPerSec);

    // IMPORTANT: Add Earth barycenter orbital velocity (restored / reaffirmed)
    const earthVel = getEarthBaryVelocityAUPerSec();
    const initialVel = earthVel.add(randomVel); // add vectors

    const proj = new Projectile(`proj-${++projectileCounter}`, origin, initialVel);
    registerEntity(proj);
  };

  return (
    <div>
      <button
        style={{
          position: 'absolute',
          top: '34px',
          left: '8px',
          background: '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          marginBottom: '4px'
        }}
        onClick={onClick}
      >
        Launch Projectile
      </button>
      <button
        style={{
          position: 'absolute',
          top: '70px',
          left: '8px',
          background: laserOn ? '#ff4444' : '#444',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          fontSize: 12,
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
        }}
        onClick={() => {
          if (!laserRef.current) {
            const meteorId = findMeteorId();
            const l1 = ENTITIES.find(e => (e as any).id === 'sun-earth-L1');
            if (meteorId && l1) {
              const laser = new LaserWeapon('laser-l1-meteor', 'sun-earth-L1', meteorId);
              laserRef.current = laser;
              reg(laser);
            }
          }
          if (laserRef.current) {
            laserRef.current.toggle();
            setLaserOn(laserRef.current.isActive());
          }
        }}
      >
        {laserOn ? 'Disable Laser' : 'Enable Laser'}
      </button>
    </div>
  );
};

export default LaunchButton;
