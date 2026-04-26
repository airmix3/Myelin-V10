import OrgContextClient from './OrgContextClient';

export const metadata = {
  title: 'Org Context | Myelin Cortex',
};

export default function OrgContextPage() {
  return <OrgContextClient defaultDept="tech" />;
}
