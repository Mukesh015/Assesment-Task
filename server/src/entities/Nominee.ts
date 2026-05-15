import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Poll } from './Poll'
import { Vote } from './Vote'

@Entity({ name: 'nominees' })
export class Nominee {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 120 })
  name!: string

  @Column({ type: 'varchar', length: 120 })
  party!: string

  @Column({ type: 'varchar', length: 255 })
  description!: string

  @Column({ type: 'varchar', length: 16 })
  color!: string

  @Column({ type: 'boolean', default: true })
  isActive!: boolean

  @Column({ type: 'int', nullable: true })
  pollId!: number | null

  @ManyToOne(() => Poll, (poll) => poll.nominees, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll | null

  @OneToMany(() => Vote, (vote) => vote.nominee)
  votes!: Vote[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
