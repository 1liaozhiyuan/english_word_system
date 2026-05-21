import { api, getAuthHeaders } from './client';
import type { MembershipOrder, MembershipPlan, MembershipStatus } from '../types';

export async function getMembershipStatus(token: string) {
  const { data } = await api.get<MembershipStatus>('/membership/status', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function demoUpgradeMembership(token: string) {
  const { data } = await api.post<MembershipStatus>(
    '/membership/demo-upgrade',
    {},
    { headers: getAuthHeaders(token) },
  );
  return data;
}

export async function getMembershipPlans(token: string) {
  const { data } = await api.get<MembershipPlan[]>('/membership/plans', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function getMembershipOrders(token: string) {
  const { data } = await api.get<MembershipOrder[]>('/membership/orders', {
    headers: getAuthHeaders(token),
  });
  return data;
}

export async function demoPayMembershipOrder(token: string, planId: number) {
  const { data } = await api.post<MembershipOrder>(
    '/membership/orders/demo-pay',
    { plan_id: planId },
    { headers: getAuthHeaders(token) },
  );
  return data;
}
