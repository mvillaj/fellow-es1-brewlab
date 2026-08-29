import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Coffee } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Empty, Modal } from '../components/ui';
import CoffeeCard from '../components/CoffeeCard';
import CoffeeForm from '../components/CoffeeForm';

export default function Coffees() {
  const navigate = useNavigate();
  const coffees = useApi<Coffee[]>('/coffees');
  const [editing, setEditing] = useState<Coffee | null | undefined>(undefined);

  async function remove(c: Coffee) {
    await api(`/coffees/${c.id}`, { method: 'DELETE' });
    void coffees.reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>My coffees</h1>
          <p>The bags on your shelf. Publish one and it shows up in Explore for everyone else.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>
          Add coffee
        </button>
      </div>

      {coffees.data?.length ? (
        <div className="grid grid-2">
          {coffees.data.map((c) => (
            <CoffeeCard
              key={c.id}
              coffee={c}
              action={
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(c)}>
                    ✕
                  </button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <Empty title="Nothing on the shelf">Add the bag you are drinking now — everything else hangs off it.</Empty>
      )}

      {editing !== undefined ? (
        <Modal title={editing ? 'Edit coffee' : 'Add coffee'} onClose={() => setEditing(undefined)} wide>
          <CoffeeForm
            existing={editing}
            onSaved={(saved) => {
              const wasNew = !editing;
              setEditing(undefined);
              void coffees.reload();
              // Straight to the new coffee, where the profile suggestion is.
              if (wasNew) navigate(`/coffees/${saved.id}`);
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}
