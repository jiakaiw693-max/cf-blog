import { handleUpdates } from '../../worker/updates.mjs';

// 已连接 Pages 的仓库也可使用同一个免费接口。
export function onRequest(context) {
  return handleUpdates(context.request, context);
}
