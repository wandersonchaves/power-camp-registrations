import Link from 'next/link'

import {Button} from '@/components/ui/button'

export const Footer = () => {
  return (
    <footer className="text-muted-foreground absolute bottom-2 w-full text-center text-sm">
      © {new Date().getFullYear()} By{' '}
      <Button
        variant="link"
        className="p-0"
        asChild
      >
        <Link href="https://wandersonchaves.vercel.app/">Wanderson Chaves</Link>
      </Button>
    </footer>
  )
}
