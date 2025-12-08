// src/components/SpecialistServices.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SpecialistServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadServices() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("services")
          .select("id, name, description, icon_url")
          .order("name", { ascending: true });

        if (error) throw error;

        setServices(data || []);
      } catch (err) {
        console.error("Error loading services:", err);
        setError("Unable to load services at this time.");
      } finally {
        setLoading(false);
      }
    }

    loadServices();
  }, []);

  if (loading) return <p>Loading services…</p>;
  if (error) return <p>{error}</p>;

  return (
    <section className="cb-section">
      <h2>Specialist Services</h2>
      <div className="services-grid">
        {services.map((s) => (
          <div key={s.id} className="service-card">
            <img src={s.icon_url} alt={s.name} />
            <h3>{s.name}</h3>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
