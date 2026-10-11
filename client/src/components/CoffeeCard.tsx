import { Link } from 'react-router-dom';
import type { Coffee } from '@brewlab/shared';
import { daysOffRoast } from '../lib/format';

export default function CoffeeCard({ coffee, action }: { coffee: Coffee; action?: React.ReactNode }) {
  const off = daysOffRoast(coffee.roastDate);
  return (
    <div className="list-item">
      <div className="spread align-start">
        <div>
          <Link className="item-title" to={`/coffees/${coffee.id}`}>
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

      <div className="row-wrap small mt-2">
        {coffee.roastLevel ? <span className="tag">{coffee.roastLevel}</span> : null}
        {coffee.process ? <span className="tag cool">{coffee.process}</span> : null}
        {coffee.varietal ? <span className="tag">{coffee.varietal}</span> : null}
        {off != null ? (
          <span className={`tag ${off > 30 ? 'bad' : off < 5 ? '' : 'good'}`}>{off}d off roast</span>
        ) : null}
        {coffee.isPublic ? <span className="tag accent">shared</span> : null}
      </div>

      {coffee.tastingNotes.length ? (
        <div className="small dim mt-2">
          {coffee.tastingNotes.join(' · ')}
        </div>
      ) : null}

      <div className="small faint mt-2">
        {coffee.shotCount ?? 0} shots
        {coffee.avgRating ? ` · ${coffee.avgRating}★ average` : ''}
        {coffee.cloneCount ? ` · cloned ${coffee.cloneCount}×` : ''}
        {coffee.ownerName ? ` · by ${coffee.ownerName}` : ''}
      </div>
    </div>
  );
}
