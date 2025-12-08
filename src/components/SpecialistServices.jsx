// src/components/SpecialistServices.jsx
import React, { useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

export default function SpecialistServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadServices() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: svcError } = await supabase
          .from("specialist_services") // 👈 table name – match this in Supabase
          .select("id, name, description, image_url, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (svcError) throw svcError;
        setServices(data || []);
      } catch (err) {
        console.error("Error loading specialist services:", err);
        setError("Unable to load services at this time.");
      } finally {
        setLoading(false);
      }
    }

    loadServices();
  }, []);

  if (loading) {
    return (
      <section className="cb-section" id="specialist-services">
        <p>Loading specialist services…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cb-section" id="specialist-services">
        <p>{error}</p>
      </section>
    );
  }

  if (!services.length) {
    return (
      <section className="cb-section" id="specialist-services">
        <h2 className="cb-mission_title">Specialist Services</h2>
        <p>No specialist services are configured yet.</p>
      </section>
    );
  }

  return (
    <section className="cb-section" id="specialist-services">
      <div className="cb-section_inner">
        <h2 className="cb-mission_title">Specialist Services</h2>
        <div className="cb-category-grid cb-services-grid">
          {services.map((s) => {
            const imageSrc =
              s.image_url && s.image_url.trim().length > 0
                ? s.image_url
                : "/images/service-placeholder.jpg"; // add this file too

            return (
              <article
                key={s.id}
                className="cb-card cb-card--service"
                aria-label={s.name}
              >
                <div className="cb-card_image">
                  <img src={imageSrc} alt={s.name} loading="lazy" />
                </div>
                <div className="cb-card_body">
                  <h3 className="cb-card_title">{s.name}</h3>
                  {s.description && (
                    <p className="cb-card_description">{s.description}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
