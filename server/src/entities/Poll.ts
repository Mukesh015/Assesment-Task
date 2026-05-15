import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Nominee } from './Nominee'
import { Vote } from './Vote'

@Entity({ name: 'polls' })
export class Poll {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 150 })
  title!: string

  @Column({ type: 'varchar', length: 255, default: '' })
  description!: string

  @Column({ type: 'boolean', default: true })
  isActive!: boolean

  @OneToMany(() => Nominee, (nominee) => nominee.poll)
  nominees!: Nominee[]

  @OneToMany(() => Vote, (vote) => vote.poll)
  votes!: Vote[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
