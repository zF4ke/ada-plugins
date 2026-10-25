const success = value => ({ outcome: 'succeeded', released: true, value });
async function read(context) {
  const state = await context.broker('state.read', { slot: 'counter' });
  return { revision: state.revision, count: state.value?.count ?? 0 };
}
export default {
  handlers: {
    async state(_arguments, context) { return success(await read(context)); },
    async increment(arguments_, context) {
      const state = await read(context);
      if (state.revision !== arguments_.expectedRevision) throw new Error('Refresh the counter before changing it.');
      const next = await context.broker('state.write', { slot: 'counter', expectedRevision: state.revision, value: { count: state.count + 1 } });
      return success({ revision: next.revision, count: next.value.count });
    }
  }
};
