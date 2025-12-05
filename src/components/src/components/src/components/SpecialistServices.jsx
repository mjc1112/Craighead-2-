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
          .from("services") // adjust table name if needed
          .select("id, name, description, slug")
          .order("name", { ascending: true });

        if (error) throw error;
        setServices(data || []);
      } catch (err) {
        console.error("Error loading services from Supabase", err);
        setError("We couldn’t load the specialist services just now.");
      } finally {
        setLoading(false);
      }
    }

    loadServices();
  }, []);

  return (
    <section id="services" className="cb-section cb-section--services">
      <div className="cb-section__inner">
        <h2 className="cb-mission__title">Specialist Services</h2>

        {loading && <p>Loading services…</p>}
        {error && <p>{error}</p>}

        {!loading && !error && !services.length && (
          <p>No specialist services found.</p>
        )}

        <div className="cb-services-grid">
          {services.map((service) => (
            <article key={service.id} className="cb-service-card">
              <h3 className="cb-service-card__title">
                {service.name || "Unnamed service"}
              </h3>
              {service.description && (
                <p className="cb-service-card__description">
                  {service.description}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
