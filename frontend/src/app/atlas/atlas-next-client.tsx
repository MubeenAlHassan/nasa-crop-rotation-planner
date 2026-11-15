'use client';

import Link from 'next/link';
import Atlas from './atlas-client';

/** Router integration stays out of the plain React offline entry point. */
export default function AtlasNext() {
  return <Atlas NavigationLink={Link} />;
}
