const global = globalThis;

  const STORAGE_PREFIX = 'second-algorithm:';
  let fieldSequence = 0;

  // A transport is optional and must explicitly confirm receipt with {ok:true}.
  // This module has no network client, polling, gesture submission or seeded history.
export function createReaderQuestions({getContext, toast = () => {}, transport = null, history = null, retry = null, onRead = () => {}} = {}) {
    if (typeof getContext !== 'function') throw new TypeError('getContext is required');
    if (transport !== null && typeof transport !== 'function') throw new TypeError('transport must be a function or null');

    const states = new Map();
    let mounted = null, destroyed = false;

    function currentContext() {
      const value = getContext() || {};
      return {
        owner: typeof value.owner === 'string' ? value.owner : '',
        chapterId: typeof value.chapterId === 'string' ? value.chapterId : '',
        title: typeof value.title === 'string' ? value.title : '',
        revision: typeof value.revision === 'string' ? value.revision : ''
      };
    }

    function storageKey(context) {
      if (!context.owner || !context.chapterId || !context.revision) throw new Error('当前章节版本暂不可用。');
      return STORAGE_PREFIX + context.owner + ':questions:v1:' + encodeURIComponent(context.chapterId) + ':' + encodeURIComponent(context.revision);
    }

    function readStored(key) {
      try {
        const value = JSON.parse(global.localStorage.getItem(key) || 'null');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      } catch { return null; }
    }

    function pendingEntries(value) {
      return (Array.isArray(value?.pending) ? value.pending : []).filter(item =>
        item && typeof item.id === 'string' && /^[a-f0-9-]{36}$/i.test(item.id)
        && typeof item.question === 'string' && item.question.trim() && item.question.length <= 6000
      ).map(item => [item.question, {id:item.id, question:item.question}]);
    }

    function load(context) {
      const key = storageKey(context);
      if (!states.has(key)) {
        const saved = readStored(key);
        states.set(key, {
          key, context, text:typeof saved?.text === 'string' ? saved.text : '',
          pending:new Map(pendingEntries(saved)), messages:[], sending:false, status:'', storageFailed:false
        });
      }
      const state = states.get(key);
      state.context = context;
      return state;
    }

    function showStatus(state, message, notify = false) {
      state.status = message;
      if (mounted?.state === state) mounted.status.textContent = message;
      // An open form already has its own status line; do not obscure the input
      // with a second copy of that message. Notify only after it is unmounted.
      if (notify && mounted?.state !== state) toast(message);
    }

    function save(state, completed = null) {
      const saved = readStored(state.key), pending = new Map(pendingEntries(saved));
      for (const [question, item] of state.pending) pending.set(question, item);
      if (completed && pending.get(completed.question)?.id === completed.id) pending.delete(completed.question);
      // A late success may acknowledge its own text, never a newer stored draft.
      const text = completed && !state.text && typeof saved?.text === 'string'
        && saved.text !== completed.raw ? saved.text : state.text;
      try {
        global.localStorage.setItem(state.key, JSON.stringify({text, pending:[...pending.values()]}));
        state.storageFailed = false;
        return true;
      } catch {
        if (!state.storageFailed) toast('本机保存失败，请保留此页面或复制问题。');
        state.storageFailed = true;
        return false;
      }
    }

    function captureDraft() {
      if (!mounted) return;
      mounted.state.text = mounted.input.value;
      save(mounted.state);
    }

    function requestId() {
      if (typeof global.crypto?.randomUUID === 'function') return global.crypto.randomUUID();
      if (typeof global.crypto?.getRandomValues !== 'function') throw new Error('当前环境无法生成请求编号，问题未发送。');
      const bytes = global.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }

    function element(document, tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function displayMessages(view) {
      const {document, messages, state} = view;
      messages.replaceChildren();
      if (!state.messages.length) {
        messages.append(element(document, 'p', 'question-status reader-question-empty', '暂无问答'));
        return;
      }
      for (const turn of state.messages) {
        const group = element(document, 'section', 'question-pair reader-question-turn');
        group.dataset.questionId = turn.id;
        const question = element(document, 'div', 'question-body reader-question-message reader-question-user');
        question.append(element(document, 'strong', '', '我的问题'), element(document, 'p', 'reader-question-content', turn.question));
        group.append(question);
        if (turn.answer) {
          const answer = element(document, 'div', 'question-answer reader-question-message reader-question-assistant');
          answer.append(element(document, 'strong', '', '答疑'), element(document, 'p', 'reader-question-content', turn.answer));
          group.append(answer);
        } else if (turn.status === 'failed') {
          group.append(element(document, 'p', 'question-status', turn.error === 'outcome_unknown' ? '本次结果待核对，暂不重复生成。' : '答疑未完成，问题已保留。'));
          if (retry && turn.error !== 'outcome_unknown') {
            const button=element(document,'button','action-button','重新处理');button.type='button';
            button.addEventListener('click',async()=>{button.disabled=true;try{await retry({id:turn.id});await refresh();}catch(error){showStatus(state,error.message,true);}finally{button.disabled=false;}});
            group.append(button);
          }
        } else {
          group.append(element(document, 'p', 'question-status', turn.status === 'running' ? '正在答疑…' : '等待答疑…'));
        }
        messages.append(group);
      }
    }

    function updateSending(state) {
      if (mounted?.state === state) {
        mounted.send.disabled = state.sending || !transport;
        mounted.form.setAttribute('aria-busy', String(state.sending));
      }
    }

    async function submit(view, event) {
      event.preventDefault();
      if (destroyed || mounted !== view || view.state.sending) return;
      const state = view.state, raw = view.input.value, question = raw.trim();
      state.text = raw;
      save(state);
      if (!question) { showStatus(state, '请先写下问题。'); view.input.focus(); return; }
      if (!transport) {
        showStatus(state, '尚未连接答疑服务，问题未发送。', true);
        return;
      }
      if (!state.context.chapterId || !state.context.revision) {
        showStatus(state, '当前章节版本暂不可用，问题未发送。', true);
        return;
      }
      if (question.length > 6000) { showStatus(state, '问题过长，请缩短后再发送。'); return; }

      // Preserve unknown submissions across closing, reopening and page reloads.
      for (const [text, pending] of pendingEntries(readStored(state.key))) {
        if (!state.pending.has(text)) state.pending.set(text, pending);
      }
      let pending = state.pending.get(question);
      try {
        if (!pending) { pending = {id:requestId(), question}; state.pending.set(question, pending); }
      } catch (error) { showStatus(state, error.message, true); return; }
      save(state);
      const payload = Object.freeze({id:pending.id, chapterId:state.context.chapterId, revision:state.context.revision, question});
      state.sending = true;
      updateSending(state);
      showStatus(state, '正在发送…');
      try {
        const result = await transport(payload);
        if (result?.ok !== true) throw new Error('服务尚未确认接收，问题草稿已保留。');
        if (mounted?.state === state) state.text = mounted.input.value;
        if (state.text === raw) {
          state.text = '';
          if (mounted?.state === state && mounted.input.value === raw) mounted.input.value = '';
        }
        if (state.pending.get(question)?.id === pending.id) state.pending.delete(question);
        save(state, {...pending, raw});
        if (!state.messages.some(turn => turn.id === pending.id)) {
          state.messages.push({id:pending.id, question, answer:typeof result.answer === 'string' ? result.answer : '',status:result.status||'pending'});
        }
        if (mounted?.state === state) displayMessages(mounted);
        showStatus(state, '问题已发送。');
        if(history)void refresh();
      } catch (error) {
        showStatus(state, typeof error?.message === 'string' && error.message ? error.message : '发送暂未确认，请重试。问题草稿已保留。', true);
      } finally {
        state.sending = false;
        updateSending(state);
      }
    }

    function unmount() {
      if (!mounted) return;
      mounted.input.removeEventListener('input', mounted.onInput);
      mounted.form.removeEventListener('submit', mounted.onSubmit);
      mounted = null;
    }

    async function refresh() {
      if(!history||destroyed||!mounted||global.document?.hidden)return;
      const view=mounted,state=view.state;
      try{
        const result=await history({chapterId:state.context.chapterId,revision:state.context.revision,markRead:true});
        if(destroyed||mounted!==view||currentContext().owner!==state.context.owner)return;
        if(!Array.isArray(result?.turns))throw Error('问答记录暂不可用');
        if(JSON.stringify(state.messages)!==JSON.stringify(result.turns)){
          const scrollTop=view.messages.scrollTop,atBottom=view.messages.scrollHeight-view.messages.clientHeight-scrollTop<32;
          state.messages=result.turns;displayMessages(view);
          view.messages.scrollTop=atBottom?view.messages.scrollHeight:scrollTop;
        }
        onRead();
      }catch(error){if(mounted===view)showStatus(state,'问答记录暂不可用，问题草稿已保留。');}
    }

    function render(host) {
      if (destroyed) throw new Error('Questions view has been destroyed');
      if (!host?.ownerDocument || typeof host.replaceChildren !== 'function') throw new TypeError('A DOM host is required');
      captureDraft();
      unmount();
      const document = host.ownerDocument, state = load(currentContext());
      const root = element(document, 'div', 'questions-content reader-questions');
      const context = element(document, 'div', 'question-status reader-question-context', state.context.title || '当前章节');
      const serviceStatus = element(document, 'p', 'question-status reader-question-service-status', !transport ? '尚未连接答疑服务，问题不会发送；草稿保存在本机。' : '');
      serviceStatus.hidden = Boolean(transport);
      const messages = element(document, 'div', 'question-list reader-question-messages');
      messages.tabIndex = 0;
      messages.setAttribute('role', 'region');
      messages.setAttribute('aria-label', '本章问答记录');
      const form = element(document, 'form', 'question-form reader-question-compose');
      const fieldId = 'reader-question-input-' + (++fieldSequence);
      const label = element(document, 'label', 'field-label reader-question-label', '我的问题');
      label.htmlFor = fieldId;
      const input = element(document, 'textarea', 'text-input reader-question-input');
      input.id = fieldId;
      input.name = 'question';
      input.rows = 4;
      input.maxLength = 6000;
      input.placeholder = '写下对本章的问题';
      input.value = state.text;
      const row = element(document, 'div', 'question-actions reader-question-send-row');
      const status = element(document, 'p', 'question-status reader-question-status', state.status);
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const send = element(document, 'button', 'primary-button reader-question-send', '发送');
      send.type = 'submit';
      row.append(status, send);
      form.append(label, input, row);
      root.append(context, serviceStatus, messages, form);
      const view = {document, host, root, context, messages, form, input, status, send, state};
      view.onInput = () => {
        state.text = input.value;
        if (!save(state)) showStatus(state, '本机保存失败，请保留此页面或复制问题。');
      };
      view.onSubmit = event => { void submit(view, event); };
      input.addEventListener('input', view.onInput);
      form.addEventListener('submit', view.onSubmit);
      mounted = view;
      host.replaceChildren(root);
      displayMessages(view);
      updateSending(state);
      if(history)void refresh();
      return root;
    }

    function destroy() {
      if (destroyed) return;
      captureDraft();
      unmount();
      destroyed = true;
      if(refreshTimer)global.clearInterval(refreshTimer);
    }
    const refreshTimer=history&&typeof global.setInterval==='function'?global.setInterval(()=>void refresh(),15000):null;
    refreshTimer?.unref?.();
    return Object.freeze({render, captureDraft, destroy, refresh});
}

