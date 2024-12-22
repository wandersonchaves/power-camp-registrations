'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import type {Session} from 'next-auth'
import {getSession} from 'next-auth/react'

import {SignInButton} from '@/components/navbar/sign-in-button'
import {UserDropdown} from '@/components/navbar/user-dropdown'

const Navbar = () => {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const fetchSession = async () => {
      const sessionData = await getSession()
      setSession(sessionData)
    }
    fetchSession()
  }, [])
  return (
    <header className="w-full border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="font-mono text-lg font-bold"
        >
          NEXT-CARNET
        </Link>
        <div className="flex items-center gap-2">
          {session ? <UserDropdown session={session} /> : <SignInButton />}
        </div>
      </div>
    </header>
  )
}

export default Navbar
