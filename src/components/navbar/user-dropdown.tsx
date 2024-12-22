'use client'

import {useState} from 'react'
import Image from 'next/image'
import {Session} from 'next-auth'
import {signOut} from 'next-auth/react'

import {Icons} from '@/components/icons'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const UserDropdown = ({session: {user}}: {session: Session}) => {
  const [isPending, setIsPending] = useState(false)

  const handleCreateCheckoutSession = async () => {
    setIsPending(true)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Image
          className="overflow-hidden rounded-full"
          src={`${user?.image}`}
          alt={`${user?.name}`}
          width={32}
          height={32}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-col items-center justify-center p-2">
          <Image
            className="overflow-hidden rounded-full"
            src={`${user?.image}`}
            alt={`${user?.name}`}
            width={100}
            height={100}
          />
          <h2 className="py-2 text-lg font-bold">{user?.name}</h2>
          <Button
            onClick={handleCreateCheckoutSession}
            disabled={user?.isActive || isPending}
            className="w-64"
          >
            {user?.isActive ? (
              'Atualizar para Pro'
            ) : (
              <>
                {isPending && (
                  <Icons.Loader className="mr-2 size-4 animate-spin" />
                )}
                Você é profissional!
              </>
            )}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <Icons.LogOut className="mr-2 size-4" /> <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
