import { Link } from 'react-router-dom';
import type { Coffee } from '@brewlab/shared';
import { daysOffRoast } from '../lib/format';

export default function CoffeeCard({ coffee, action }: { coffee: Coffee; action?: React.ReactNode }) {
  const off = daysOffRoast(coffee.roastDate);
  return (
    <div className="list-item">
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <Link to={`/coffees/${coffee.id}`} style={{ fontSize: '1.05rem' }}>
            {coffee.name}
          </Link>
          <div className="small dim">
            {coffee.roaster}
            {coffee.origin ? ` · ${coffee.origin}` : ''}
            {coffee.region ? `, ${coffee.region}` : ''}
          </div>
        </div>
        {action}
      </div>

      <div className="row-wrap small" style={{ marginTop: 10 }}>
        {coffee.roastLevel ? <span className="tag">{coffee.roastLevel}</span> : null}
        {coffee.process ? <span className="tag cool">{coffee.process}</span> : null}
        {coffee.varietal ? <span className="tag">{coffee.varietal}</span> : null}
        {off != null ? (
          <span className={`tag ${off > 30 ? 'bad' : off < 5 ? '' : 'good'}`}>{off}d off roast</span>
        ) : null}
        {coffee.isPublic ? <span className="tag crema">shared</span> : null}
      </div>

      {coffee.tastingNotes.length ? (
        <div className="small dim" style={{ marginTop: 8 }}>
          {coffee.tastingNotes.join(' · ')}
        </div>
      ) : null}

      <div className="small faint" style={{ marginTop: 10 }}>
        {coffee.shotCount ?? 0} shots
        {coffee.avgRating ? ` · ${coffee.avgRating}★ average` : ''}
        {coffee.cloneCount ? ` · cloned ${coffee.cloneCount}×` : ''}
        {coffee.ownerName ? ` · by ${coffee.ownerName}` : ''}
      </div>
    </div>
  );
}
