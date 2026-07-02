import { Hono } from 'hono'
import reconcileRoute from './reconcile.js'
import tierReevalRoute from './tier-reeval.js'
import type { Env } from '../../types/env.js'

const cronRoutes = new Hono<{ Bindings: Env }>()

cronRoutes.route('/reconcile', reconcileRoute)
cronRoutes.route('/tier-reeval', tierReevalRoute)

export default cronRoutes
