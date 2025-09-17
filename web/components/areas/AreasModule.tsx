'use client';

import PageLayout from '../PageLayout';
import AreasManager from './AreasManager';

const MODULE_TITLE = 'Области';
const MODULE_DESCRIPTION =
  'Структурируйте сферы ответственности, создавайте вложенные области и управляйте деревом PARA.';

export default function AreasModule() {
  return (
    <PageLayout title={MODULE_TITLE} description={MODULE_DESCRIPTION}>
      <AreasManager />
    </PageLayout>
  );
}
