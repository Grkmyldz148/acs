/* global React, ACS */
const { useState: useStateRW, useEffect: useEffectRW, useRef: useRefRW } = React;

/* ---------- Real-world: Todo + Form + Notify ---------- */

function TodoExample({ play }) {
  const [items, setItems] = useStateRW([
    { id: 1, text: 'Ship v0.9', done: true },
    { id: 2, text: 'Update docs site', done: false },
    { id: 3, text: 'Cut release notes', done: false },
  ]);
  const [input, setInput] = useStateRW('');

  const toggle = (id) => {
    setItems(items.map(it => {
      if (it.id === id) {
        play(it.done ? 'toggle-off' : 'toggle-on');
        return { ...it, done: !it.done };
      }
      return it;
    }));
  };

  const add = () => {
    if (!input.trim()) return;
    play('pop');
    setItems([...items, { id: Date.now(), text: input.trim(), done: false }]);
    setInput('');
  };

  const remove = (id) => {
    play('thunk');
    setItems(items.filter(it => it.id !== id));
  };

  return (
    <div className="rw-app">
      <div className="rw-app-head">
        <span className="rw-tag mono">todo.acs</span>
        <span className="rw-counter mono">{items.filter(i => !i.done).length} open</span>
      </div>
      <ul className="todo-list">
        {items.map(it => (
          <li key={it.id} className={`todo-item ${it.done ? 'done' : ''}`}>
            <button className="todo-check" onClick={() => toggle(it.id)} aria-label="toggle">
              {it.done && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5,6.5 5,9 9.5,3"/></svg>}
            </button>
            <span className="todo-text">{it.text}</span>
            <button className="todo-x" onClick={() => remove(it.id)} aria-label="delete">×</button>
          </li>
        ))}
      </ul>
      <div className="todo-add">
        <input
          type="text"
          className="todo-input mono"
          placeholder="new task…"
          value={input}
          onInput={() => play('keystroke')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="todo-add-btn" onClick={add}>Add</button>
      </div>
    </div>
  );
}

function FormExample({ play }) {
  const [email, setEmail] = useStateRW('');
  const [pass, setPass] = useStateRW('');
  const [state, setState] = useStateRW(null); // 'error' | 'success'

  const submit = () => {
    if (!/.+@.+\..+/.test(email) || pass.length < 6) {
      setState('error');
      play('error');
      setTimeout(() => setState(null), 1600);
    } else {
      setState('success');
      play('complete');
      setTimeout(() => setState(null), 2400);
    }
  };

  return (
    <div className="rw-app">
      <div className="rw-app-head">
        <span className="rw-tag mono">form.acs</span>
        {state === 'error' && <span className="rw-counter rw-error mono">invalid</span>}
        {state === 'success' && <span className="rw-counter rw-success mono">welcome</span>}
      </div>
      <div className="form-body">
        <label className="form-field">
          <span className="form-label mono">email</span>
          <input
            type="email"
            className={`form-input ${state === 'error' && !/.+@.+\..+/.test(email) ? 'is-error' : ''}`}
            value={email}
            onInput={() => play('keystroke')}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="form-field">
          <span className="form-label mono">password</span>
          <input
            type="password"
            className={`form-input ${state === 'error' && pass.length < 6 ? 'is-error' : ''}`}
            value={pass}
            onInput={() => play('keystroke')}
            onChange={(e) => setPass(e.target.value)}
            placeholder="at least 6 chars"
          />
        </label>
        <button
          className={`form-submit ${state || ''}`}
          onClick={submit}
          onMouseEnter={() => play('tick')}
        >
          {state === 'success' ? '✓ Signed in' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

function NotifyExample({ play }) {
  const [toasts, setToasts] = useStateRW([]);
  const counterRef = useRefRW(0);

  const types = [
    { kind: 'mention',  sound: 'mention',  text: '@alex mentioned you in #design',  icon: '@' },
    { kind: 'success',  sound: 'success',  text: 'Build #2417 passed in 1m 23s',     icon: '✓' },
    { kind: 'error',    sound: 'denied',   text: 'Deploy failed: missing env var',   icon: '!' },
    { kind: 'badge',    sound: 'badge',    text: '3 new pull requests assigned',     icon: '#' },
    { kind: 'ding',     sound: 'ding',     text: 'Maya joined the call',             icon: '◐' },
  ];

  const fire = (t) => {
    const id = ++counterRef.current;
    play(t.sound);
    setToasts(prev => [...prev, { id, ...t }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 2800);
  };

  return (
    <div className="rw-app">
      <div className="rw-app-head">
        <span className="rw-tag mono">notify.acs</span>
        <span className="rw-counter mono">{toasts.length} active</span>
      </div>
      <div className="notify-buttons">
        {types.map(t => (
          <button key={t.kind} className="notify-trigger" onClick={() => fire(t)}>
            <span className={`notify-trigger-icon notify-${t.kind}`}>{t.icon}</span>
            <span className="mono">{t.kind}</span>
          </button>
        ))}
      </div>
      <div className="notify-stack">
        {toasts.map(t => (
          <div key={t.id} className={`notify-toast notify-${t.kind}`}>
            <span className="notify-toast-icon">{t.icon}</span>
            <span className="notify-toast-text">{t.text}</span>
            <span className="notify-toast-sound mono">→ {t.sound}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.RealWorld = function RealWorld({ soundOn, requestSound }) {
  const [tab, setTab] = useStateRW('todo');
  const play = (s) => {
    if (!soundOn) { requestSound(); return; }
    window.ACS.play(s);
  };

  const tabs = [
    { id: 'todo',   label: 'Todo list',     code: `.todo-check { sound-on-click: toggle-on; }\n.todo-x     { sound-on-click: thunk; }\ninput:on-input { sound: keystroke; }` },
    { id: 'form',   label: 'Form validation', code: `.form-input.is-error { sound-on-input: tick; }\n.form-submit         { sound-on-click: complete; }\n.form-submit.error   { sound-on-click: error; }` },
    { id: 'notify', label: 'Notifications', code: `.notify-toast.success { sound-on-appear: success; }\n.notify-toast.mention { sound-on-appear: mention; }\n.notify-toast.error   { sound-on-appear: denied; }` },
  ];

  return (
    <section className="section" id="examples">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Real-world</span>
          <h2 className="section-title">Three little apps,<br/>one cascade each.</h2>
          <p className="section-sub">Drop ACS into anything — a todo list, a form, a notification system. Below each demo is the actual stylesheet powering it.</p>
        </div>

        <div className="rw-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`rw-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="rw-grid">
          <div className="rw-demo">
            {tab === 'todo'   && <TodoExample play={play} />}
            {tab === 'form'   && <FormExample play={play} />}
            {tab === 'notify' && <NotifyExample play={play} />}
          </div>
          <div className="rw-stylesheet">
            <div className="window">
              <div className="window-bar">
                <div className="window-dots"><span></span><span></span><span></span></div>
                <div className="window-title mono">{tab}.acs</div>
                <div className="window-actions"><span className="window-tag mono">acs</span></div>
              </div>
              <pre className="code code-flush mono">{tabs.find(t => t.id === tab).code}</pre>
            </div>
            <p className="rw-stylesheet-note">
              That's the entire audio layer. The components don't import the runtime, don't call <code className="mono">play()</code>, don't know sound exists. The stylesheet binds it all from the outside.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
