import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import emailjs from "@emailjs/browser";
import OrbCanvas, { type OrbState } from "./OrbCanvas";
import "./ContactForm.css";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

type Status = "idle" | "sending" | "success" | "error";

interface Values {
  name: string;
  email: string;
}

type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validate = (v: Values): Errors => {
  const errors: Errors = {};
  if (v.name.trim().length < 2) errors.name = "Escribe tu nombre (mínimo 2 caracteres).";
  if (!v.email.trim()) errors.email = "Escribe tu correo.";
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = "Revisa el formato, por ejemplo nombre@correo.com.";
  return errors;
};

export default function ContactForm() {
  const [values, setValues] = useState<Values>({ name: "", email: "" });
  const [touched, setTouched] = useState<Record<Field, boolean>>({ name: false, email: false });
  const [status, setStatus] = useState<Status>("idle");
  const [focused, setFocused] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const trapRef = useRef<HTMLInputElement>(null);

  const errors = validate(values);
  const showError = (f: Field) => (touched[f] ? errors[f] : undefined);

  const orbState: OrbState =
    status === "sending" ? "sending" : status === "success" ? "success" : focused ? "focus" : "idle";

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (status === "success" || status === "error") setStatus("idle");
  };

  const handleBlur = (field: Field) => {
    setFocused(false);
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;

    // Campo trampa para bots: si tiene contenido, se ignora el envío
    if (trapRef.current?.value) return;

    setTouched({ name: true, email: true });
    if (errors.name) return nameRef.current?.focus();
    if (errors.email) return emailRef.current?.focus();

    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      console.error("Faltan variables VITE_EMAILJS_* en el archivo .env");
      setStatus("error");
      return;
    }

    setStatus("sending");
    try {
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          from_name: values.name.trim(),
          from_email: values.email.trim(),
          reply_to: values.email.trim(),
        },
        { publicKey: PUBLIC_KEY }
      );
      setStatus("success");
      setValues({ name: "", email: "" });
      setTouched({ name: false, email: false });
    } catch (err) {
      console.error("EmailJS error:", err);
      setStatus("error");
    }
  };

  return (
    <section className="contact" id="contacto">
      <div className="contact__inner">
        <div className="contact__orb">
          <OrbCanvas state={orbState} />
        </div>

        <div className="contact__panel">
          <h2 className="contact__title">Cuéntanos quién eres</h2>
          <p className="contact__lead">Déjanos tu nombre y tu correo y te escribimos para continuar.</p>

          <form className="contact__form" onSubmit={handleSubmit} noValidate>
            <div className="contact__field">
              <label htmlFor="contact-name">Nombre</label>
              <input
                ref={nameRef}
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Tu nombre"
                value={values.name}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onBlur={() => handleBlur("name")}
                aria-invalid={Boolean(showError("name"))}
                aria-describedby={showError("name") ? "contact-name-error" : undefined}
              />
              {showError("name") && (
                <p className="contact__error" id="contact-name-error">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="contact__field">
              <label htmlFor="contact-email">Correo electrónico</label>
              <input
                ref={emailRef}
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@correo.com"
                value={values.email}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onBlur={() => handleBlur("email")}
                aria-invalid={Boolean(showError("email"))}
                aria-describedby={showError("email") ? "contact-email-error" : undefined}
              />
              {showError("email") && (
                <p className="contact__error" id="contact-email-error">
                  {errors.email}
                </p>
              )}
            </div>

            <input
              ref={trapRef}
              className="contact__trap"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <button className="contact__submit" type="submit" disabled={status === "sending"}>
              {status === "sending" && <span className="contact__spinner" aria-hidden="true" />}
              {status === "sending" ? "Enviando" : "Enviar"}
            </button>

            <p
              className={`contact__status contact__status--${status}`}
              role="status"
              aria-live="polite"
            >
              {status === "success" && "Enviado. Te escribiremos al correo que dejaste."}
              {status === "error" && "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo."}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
